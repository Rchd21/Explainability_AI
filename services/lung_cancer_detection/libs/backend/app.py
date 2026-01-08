# ====== Third-party Library Imports ======
from fastapi import FastAPI

# ====== Local Project Imports ======
# App's lifespan
from .lifespan import lifespan
# Routers
from .routes import (
    health_router,
    detector_router,
)
# Context
from .context import CONTEXT


def create_app():
    app = FastAPI(
        title=CONTEXT.config.FASTAPI_APP_NAME,
        lifespan=lifespan(),
        debug=True
    )

    # Include API routers with CONFIG.BASE_API_PATH prefix for organized endpoint grouping.
    app.include_router(
        router=health_router,
        prefix=f"{CONTEXT.config.BASE_API_PATH}health"
    )
    app.include_router(
        router=detector_router,
        prefix=f"{CONTEXT.config.BASE_API_PATH}detector"
    )
    # TODO: ici on ajoute les routers des nouveaux groupes de endpoints si besoin
    return app


__all__ = ["create_app"]
