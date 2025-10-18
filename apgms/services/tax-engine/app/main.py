import datetime
import json
import logging
import os
import threading
import time
from typing import Dict, Iterable, Tuple

try:
    import resource
except ImportError:  # pragma: no cover - only relevant on non-Unix platforms
    resource = None  # type: ignore[assignment]

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

SERVICE_NAME = os.getenv("SERVICE_NAME", "tax-engine")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
CONTENT_TYPE = "text/plain; version=0.0.4"

RESERVED_LOG_FIELDS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": SERVICE_NAME,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in RESERVED_LOG_FIELDS or key.startswith("_"):
                continue
            payload[key] = value

        return json.dumps(payload)


logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(LOG_LEVEL)
logger.handlers.clear()
logger.propagate = False
_handler = logging.StreamHandler()
_handler.setFormatter(JsonFormatter())
logger.addHandler(_handler)

Labels = Dict[str, str]


def _labels_key(labels: Labels) -> Tuple[Tuple[str, str], ...]:
    return tuple(sorted((key, str(value)) for key, value in labels.items()))


def _format_pairs(pairs: Iterable[Tuple[str, str]]) -> str:
    items = list(pairs)
    if not items:
        return "{}"
    return "{" + ",".join(f'{k}="{v}"' for k, v in items) + "}"


class CounterMetric:
    def __init__(self, name: str, help_text: str, default_labels: Labels):
        self.name = name
        self.help = help_text
        self._default_labels = default_labels
        self._samples: Dict[Tuple[Tuple[str, str], ...], float] = {}
        self._lock = threading.Lock()

    def inc(self, labels: Labels | None = None, value: float = 1.0) -> None:
        merged = {**self._default_labels, **(labels or {})}
        key = _labels_key(merged)
        with self._lock:
            self._samples[key] = self._samples.get(key, 0.0) + value

    def snapshot(self) -> Iterable[str]:
        with self._lock:
            for key, value in sorted(self._samples.items()):
                label_str = _format_pairs(key)
                yield f"{self.name}{label_str} {value}"


class GaugeMetric:
    def __init__(self, name: str, help_text: str, default_labels: Labels):
        self.name = name
        self.help = help_text
        self._default_labels = default_labels
        self._samples: Dict[Tuple[Tuple[str, str], ...], float] = {}
        self._lock = threading.Lock()

    def set(self, value: float, labels: Labels | None = None) -> None:
        merged = {**self._default_labels, **(labels or {})}
        key = _labels_key(merged)
        with self._lock:
            self._samples[key] = value

    def snapshot(self) -> Iterable[str]:
        with self._lock:
            for key, value in sorted(self._samples.items()):
                label_str = _format_pairs(key)
                yield f"{self.name}{label_str} {value}"


class HistogramMetric:
    def __init__(self, name: str, help_text: str, buckets, default_labels: Labels):
        self.name = name
        self.help = help_text
        self._buckets = buckets
        self._default_labels = default_labels
        self._samples: Dict[Tuple[Tuple[str, str], ...], Dict[str, float | list[float]]] = {}
        self._lock = threading.Lock()

    def observe(self, value: float, labels: Labels | None = None) -> None:
        merged = {**self._default_labels, **(labels or {})}
        key = _labels_key(merged)
        with self._lock:
            sample = self._samples.get(key)
            if sample is None:
                sample = {"sum": 0.0, "count": 0.0, "buckets": [0.0 for _ in self._buckets]}
                self._samples[key] = sample
            sample["sum"] = float(sample["sum"]) + value
            sample["count"] = float(sample["count"]) + 1
            buckets: list[float] = sample["buckets"]  # type: ignore[assignment]
            for idx, bound in enumerate(self._buckets):
                if value <= bound:
                    buckets[idx] += 1

    def snapshot(self) -> Iterable[str]:
        with self._lock:
            for key, sample in sorted(self._samples.items()):
                labels = dict(key)
                buckets: list[float] = sample["buckets"]  # type: ignore[assignment]
                for idx, bound in enumerate(self._buckets):
                    bucket_labels = dict(labels)
                    bucket_labels["le"] = str(bound)
                    label_str = _format_pairs(sorted(bucket_labels.items()))
                    yield f"{self.name}_bucket{label_str} {buckets[idx]}"
                inf_labels = dict(labels)
                inf_labels["le"] = "+Inf"
                inf_label_str = _format_pairs(sorted(inf_labels.items()))
                yield f"{self.name}_bucket{inf_label_str} {sample['count']}"
                base_label_str = _format_pairs(key)
                yield f"{self.name}_sum{base_label_str} {sample['sum']}"
                yield f"{self.name}_count{base_label_str} {sample['count']}"

    def start_timer(self, labels: Labels | None = None):
        start = time.perf_counter()

        def stop(extra: Labels | None = None) -> None:
            duration = time.perf_counter() - start
            merged = {**(labels or {}), **(extra or {})}
            self.observe(duration, merged)

        return stop


class MetricsRegistry:
    def __init__(self, service_name: str):
        self.default_labels = {"service": service_name}
        self.metrics: list[tuple[str, object]] = []
        self.started_at = time.time()
        self._lock = threading.Lock()

        self.process_uptime = self.register_gauge(
            "process_uptime_seconds", "Process uptime in seconds"
        )
        self.process_rss = self.register_gauge(
            "process_resident_memory_bytes", "Resident set size in bytes"
        )
        self.process_heap = self.register_gauge(
            "process_heap_used_bytes", "Heap used in bytes"
        )

    def register_counter(self, name: str, help_text: str) -> CounterMetric:
        counter = CounterMetric(name, help_text, self.default_labels)
        with self._lock:
            self.metrics.append((help_text, counter))
        return counter

    def register_gauge(self, name: str, help_text: str) -> GaugeMetric:
        gauge = GaugeMetric(name, help_text, self.default_labels)
        with self._lock:
            self.metrics.append((help_text, gauge))
        return gauge

    def register_histogram(self, name: str, help_text: str, buckets=None) -> HistogramMetric:
        histogram = HistogramMetric(
            name,
            help_text,
            buckets or [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            self.default_labels,
        )
        with self._lock:
            self.metrics.append((help_text, histogram))
        return histogram

    def collect(self) -> str:
        uptime = time.time() - self.started_at
        if resource is not None:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            rss = usage.ru_maxrss * 1024
        else:
            rss = 0
        heap = rss

        self.process_uptime.set(uptime)
        self.process_rss.set(rss)
        self.process_heap.set(heap)

        lines = []
        with self._lock:
            for help_text, metric in self.metrics:
                if isinstance(metric, CounterMetric):
                    lines.append(f"# HELP {metric.name} {help_text}")
                    lines.append(f"# TYPE {metric.name} counter")
                    lines.extend(metric.snapshot())
                elif isinstance(metric, GaugeMetric):
                    lines.append(f"# HELP {metric.name} {help_text}")
                    lines.append(f"# TYPE {metric.name} gauge")
                    lines.extend(metric.snapshot())
                elif isinstance(metric, HistogramMetric):
                    lines.append(f"# HELP {metric.name} {help_text}")
                    lines.append(f"# TYPE {metric.name} histogram")
                    lines.extend(metric.snapshot())
        return "\n".join(lines)


registry = MetricsRegistry(SERVICE_NAME)
request_count = registry.register_counter(
    "http_requests_total", "Total HTTP requests processed"
)
request_latency = registry.register_histogram(
    "http_request_duration_seconds", "HTTP request latency in seconds"
)

app = FastAPI()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    stop_timer = request_latency.start_timer({"method": request.method, "route": request.url.path})
    response = await call_next(request)
    stop_timer({"status_code": str(response.status_code)})
    duration = time.perf_counter() - start
    request_count.inc(
        {
            "method": request.method,
            "route": request.url.path,
            "status_code": str(response.status_code),
        }
    )
    logger.info(
        "request_completed",
        extra={
            "route": request.url.path,
            "status_code": response.status_code,
            "method": request.method,
            "duration_seconds": duration,
        },
    )
    return response


@app.get("/health")
def health():
    logger.debug("health_check")
    return {"ok": True, "service": SERVICE_NAME}


@app.get("/metrics")
def metrics():
    payload = registry.collect()
    return PlainTextResponse(content=payload, media_type=CONTENT_TYPE)


logger.info("tax engine service initialised", extra={"service": SERVICE_NAME})
