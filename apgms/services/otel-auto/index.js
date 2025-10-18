import http from "node:http";
import crypto from "node:crypto";

function hrTimeFromNanoseconds(value) {
  const seconds = Number(value / 1_000_000_000n);
  const nanoseconds = Number(value % 1_000_000_000n);
  return [seconds, nanoseconds];
}

function createHttpInstrumentation() {
  let exporter = null;
  let originalEmit = null;
  let enabled = false;

  const instrumentation = {
    enable(context = {}) {
      if (enabled) {
        return;
      }
      exporter = context.exporter ?? null;
      originalEmit = http.Server.prototype.emit;
      const self = this;
      http.Server.prototype.emit = function patchedEmit(event, ...args) {
        if (event === "request" && args.length >= 2) {
          self._handleRequest(args[0], args[1]);
        }
        return originalEmit.call(this, event, ...args);
      };
      enabled = true;
    },
    disable() {
      if (!enabled) {
        return;
      }
      if (originalEmit) {
        http.Server.prototype.emit = originalEmit;
      }
      originalEmit = null;
      exporter = null;
      enabled = false;
    },
    _handleRequest(req, res) {
      if (!exporter || !req || !res) {
        return;
      }
      const startTimeMs = Date.now();
      const startNs = BigInt(startTimeMs) * 1_000_000n;
      const startHr = process.hrtime.bigint();
      const traceId = crypto.randomBytes(16).toString("hex");
      const spanId = crypto.randomBytes(8).toString("hex");
      const route = typeof req.url === "string" ? req.url.split("?")[0] : undefined;

      const spanContext = {
        traceId,
        spanId,
        traceFlags: 1,
      };

      const span = {
        spanContext: () => spanContext,
        parentSpanId: undefined,
        name: `${req.method ?? "GET"} ${route ?? req.url ?? "/"}`,
        kind: "SERVER",
        startTime: hrTimeFromNanoseconds(startNs),
        endTime: undefined,
        duration: undefined,
        status: { code: "UNSET" },
        attributes: {
          "http.method": req.method,
          "http.target": req.url,
          "http.route": route,
          "http.host": req.headers?.host,
          "http.scheme": req.socket?.encrypted ? "https" : "http",
          "net.peer.ip": req.socket?.remoteAddress,
        },
        resource: {
          attributes: {
            "service.name": process.env.OTEL_SERVICE_NAME ?? process.env.npm_package_name ?? "api-gateway",
          },
        },
        instrumentationLibrary: {
          name: "custom-http-instrumentation",
          version: "0.1.0",
        },
        events: [],
        links: [],
      };

      let completed = false;

      const complete = () => {
        if (!exporter || completed) {
          return;
        }
        completed = true;
        const endHr = process.hrtime.bigint();
        const durationNs = endHr - startHr;
        const endNs = startNs + durationNs;
        span.endTime = hrTimeFromNanoseconds(endNs);
        span.duration = hrTimeFromNanoseconds(durationNs);
        span.attributes["http.status_code"] = res.statusCode;
        span.status = {
          code: res.statusCode >= 500 ? "ERROR" : "UNSET",
        };
        exporter.export([span], () => {});
      };

      res.once("finish", complete);
      res.once("close", complete);
    },
  };

  return instrumentation;
}

function getNodeAutoInstrumentations() {
  return [createHttpInstrumentation()];
}

export { getNodeAutoInstrumentations };
