# ====== Code Summary ======
# Defines the structured result model for lung cancer detection, including the selected XAI method,
# the explanation image in RGB format, and the associated lung cancer prediction metadata.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field

# ====== Internal Project Imports ======
from .prediction import LungPrediction
from .xai_method import XaiMethod


class DetectorResult(BaseModel):
    """
    Structured result from the lung cancer detector.

    Attributes:
        xai_method (XaiMethod): The explainability method used (e.g., GradCAM, LIME).
        xai_explain (list[list[list[float]]]): 3D RGB explanation image matrix.
        lung_prediction (LungPrediction): Prediction output including score, threshold, and decision.
    """
    xai_method: XaiMethod = Field(..., description="The explainability method used (e.g., GradCAM, LIME).")
    xai_explain: list[list[list[float]]] = Field(
        ...,
        description="3D explanation image in RGB format as a nested list: [H][W][3]"
    )
    lung_prediction: LungPrediction = Field(
        ...,
        description="Structured prediction result with decision, score, and threshold."
    )
