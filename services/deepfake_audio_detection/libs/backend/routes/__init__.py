# -------------------- Router --------------------- #
from .health.router import router as health_router
from .detector.router import router as detector_router

# TODO: ajouter ici les router des nouveaux endpoints au besoin

# ------------------- Public API ------------------- #
__all__ = [
    "health_router",
    "detector_router",
]
