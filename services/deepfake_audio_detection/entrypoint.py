# ====== Code Summary ======
# Application entrypoint for the deepfake audio detection service.
# Creates and configures the FastAPI application.

# ====== Third-Party Library Imports ======
from fastapi.middleware.cors import CORSMiddleware
from loggerplusplus import loggerplusplus
from fastapi import FastAPI

# ====== Internal Project Imports ======
from config import CONFIG

# Detector
from detector import FakeAudioDetector, AudioDetectorModel

# Backend & API context
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
    # Create app context -> inject shared instances to the global shared context
    CONTEXT.config = CONFIG
    CONTEXT.logger = loggerplusplus.bind(identifier="BACKEND")
    
    # Initialize detector with model
    CONTEXT.detector = FakeAudioDetector(
        model=AudioDetectorModel(
            model_path=CONFIG.DETECTOR_MODEL_PATH
        )
    )
    
    # Create the FastAPI application
    fastapi_app = create_app()
    
    # CORS: no restriction (for development)
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
