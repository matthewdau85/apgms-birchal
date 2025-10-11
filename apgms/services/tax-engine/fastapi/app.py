from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional


@dataclass
class Route:
    method: str
    path: str
    endpoint: Callable[..., Any]
    response_model: Optional[type] = None


class FastAPI:
    """A lightweight stand-in for FastAPI sufficient for unit tests."""

    def __init__(self) -> None:
        self._routes: Dict[str, Dict[str, Route]] = {}

    def _register_route(self, method: str, path: str, endpoint: Callable[..., Any], response_model: Optional[type]) -> Callable[..., Any]:
        method_map = self._routes.setdefault(method.upper(), {})
        method_map[path] = Route(method=method.upper(), path=path, endpoint=endpoint, response_model=response_model)
        return endpoint

    def get(self, path: str, *, response_model: Optional[type] = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            return self._register_route("GET", path, func, response_model)

        return decorator

    def post(self, path: str, *, response_model: Optional[type] = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            return self._register_route("POST", path, func, response_model)

        return decorator

    @property
    def routes(self) -> Dict[str, Dict[str, Route]]:
        return self._routes
