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
        debug=True,
    )

    # ─────────────────────────────────────────────
    # Lifespan compatibility layer (FastAPI 0.70.1)
    # ─────────────────────────────────────────────
    @app.on_event("startup")
    async def _startup() -> None:
        app.state._lifespan_cm = lifespan()(app)
        await app.state._lifespan_cm.__aenter__()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        cm = getattr(app.state, "_lifespan_cm", None)
        if cm is not None:
            await cm.__aexit__(None, None, None)
            app.state._lifespan_cm = None

    # ─────────────────────────────────────────────
    # Routers
    # ─────────────────────────────────────────────
    # Include API routers with CONFIG.BASE_API_PATH prefix for organized endpoint grouping.
    app.include_router(
        router=health_router,
        prefix=f"{CONTEXT.config.BASE_API_PATH}health"
    )
    app.include_router(
        router=detector_router,
        prefix=f"{CONTEXT.config.BASE_API_PATH}detector"
    )

    return app


__all__ = ["create_app"]
