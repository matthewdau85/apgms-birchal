from __future__ import annotations

from fastapi import FastAPI

from .api import router as api_router


app = FastAPI(
    title="APGMS Tax Engine",
    description="APIs for estimating, filing, and auditing tax returns.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(api_router)
