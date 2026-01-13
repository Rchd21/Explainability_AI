# -------------------- Router --------------------- #
from .health.router import router as health_router
from .detector.router import router as detector_router

# ------------------- Public API ------------------- #
__all__ = [
    "health_router",
    "detector_router",
]
