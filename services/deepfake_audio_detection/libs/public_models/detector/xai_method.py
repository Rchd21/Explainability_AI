# ====== Code Summary ======
# Enum defining available XAI (Explainable AI) methods for deepfake audio detection.

from enum import Enum


class XaiMethod(Enum):
    """
    Available explainability methods for audio deepfake detection.
    """
    GRADCAM = "gradcam"
    LIME = "lime"
    SHAP = "shap"
