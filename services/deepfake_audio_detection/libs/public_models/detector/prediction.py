# ====== Code Summary ======
# Pydantic model defining the structure of an audio deepfake prediction result.

from pydantic import BaseModel, Field


class AudioPrediction(BaseModel):
    """
    Represents the prediction result for audio deepfake detection.

    Attributes:
        decision: Human-readable decision string ('Real Audio' or 'Fake Audio Detected')
        label: Class label ('real' or 'fake')
        confidence: Confidence score for the predicted class (0.0 to 1.0)
        class_index: Index of the predicted class (0=real, 1=fake)
    """
    decision: str
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    class_index: int = Field(..., ge=0)
