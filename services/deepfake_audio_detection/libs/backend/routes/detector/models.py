# ====== Code Summary ======
# This module defines the request and response models for the deepfake audio detection
# API endpoint, including support for form-based parsing and structured output.

# ====== Standard Library Imports ======
from __future__ import annotations

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field
from fastapi import Form

# ====== Internal Project Imports ======
from public_models.detector import XaiMethod, DetectorResult


class DeepfakeAudioDetectionRequest(BaseModel):
    """
    Request model for deepfake audio detection API.
    
    Attributes:
        xai_method: The selected explainability method (gradcam or lime).
    """
    xai_method: XaiMethod = Field(..., description="XAI method to use for explanation")
    
    @classmethod
    def as_form(
        cls,
        xai_method: XaiMethod = Form(...)
    ) -> DeepfakeAudioDetectionRequest:
        """
        Support FastAPI dependency injection for `multipart/form-data`.
        
        Args:
            xai_method: XAI method submitted via form.
            
        Returns:
            DeepfakeAudioDetectionRequest: Parsed request model.
        """
        return cls(xai_method=xai_method)


class DeepfakeAudioDetectionResponse(BaseModel):
    """
    Response model for deepfake audio detection API.
    
    Attributes:
        detector_result: Structured detection result (prediction, XAI method, etc.)
        duration: Total processing time in seconds
        xai_image_base64: PNG-encoded explanation image (base64 string, no data-uri prefix)
    """
    detector_result: DetectorResult
    duration: float
    xai_image_base64: str = Field(
        ...,
        description="PNG image encoded in base64 (use 'data:image/png;base64,' + value to display)",
        min_length=1
    )
