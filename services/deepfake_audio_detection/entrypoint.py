# ====== Third-Party Library Imports ======
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus
from starlette.types import ASGIApp
from fastapi import FastAPI
from typing import cast

# ====== Internal Project Imports ======
from config import CONFIG

# Detector
from detector import FakeAudioDetector

# Background & api context
from backend import create_app, CONTEXT


# =======================
#   Application Factory
# =======================

def _build_app() -> FastAPI:
    """
    Assemble and return a fully configured FastAPI application.

    Returns:
        FastAPI: The application object to be served by Uvicorn.
    """
    # Create app context -> inject shared instance to the global shared context.
    CONTEXT.config = CONFIG
    CONTEXT.logger = loggerplusplus.bind(identifier="BACKEND")
    #CONTEXT.detector = FakeAudioDetector(...)
    # TODO: ici on instancie les classes

    # Create the FastAPI application
    fastapi_app = create_app()

    # CORS: no restriction
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return fastapi_app


# =======================
#   Application Export
# =======================
app: FastAPI = _build_app()

__all__ = ["app"]
