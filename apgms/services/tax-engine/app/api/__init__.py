from __future__ import annotations

from fastapi import APIRouter

from . import tax


router = APIRouter()
router.include_router(tax.router, prefix="/tax", tags=["tax"])
