from __future__ import annotations

import json
from dataclasses import dataclass
from http import HTTPStatus
from inspect import signature
from typing import Any

from .app import FastAPI


@dataclass
class _Response:
    status_code: int
    body: Any

    def json(self) -> Any:
        if isinstance(self.body, str):
            return json.loads(self.body)
        if hasattr(self.body, "to_dict"):
            return self.body.to_dict()
        return self.body


class TestClient:
    """Minimal test client that executes registered route handlers directly."""

    __test__ = False

    def __init__(self, app: FastAPI):
        self.app = app

    def _call(self, method: str, path: str, *, json_payload: Any | None = None) -> _Response:
        try:
            route = self.app.routes[method.upper()][path]
        except KeyError as exc:
            raise ValueError(f"No route registered for {method} {path}") from exc

        endpoint = route.endpoint
        arguments = []
        sig = signature(endpoint)
        for parameter in sig.parameters.values():
            annotation = parameter.annotation
            if json_payload is None:
                raise ValueError("Endpoint expects a payload but none was provided")
            if hasattr(annotation, "model_validate"):
                arguments.append(annotation.model_validate(json_payload))
            else:
                arguments.append(json_payload)
            break

        result = endpoint(*arguments)
        if hasattr(result, "to_dict"):
            result = result.to_dict()
        return _Response(status_code=HTTPStatus.OK, body=result)

    def post(self, path: str, json: Any | None = None) -> _Response:
        return self._call("POST", path, json_payload=json)

    def get(self, path: str) -> _Response:
        return self._call("GET", path)
