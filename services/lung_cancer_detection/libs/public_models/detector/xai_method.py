# ====== Code Summary ======
# Defines the enumeration of supported XAI (explainability) methods that can be selected
# for generating visual model explanations.

# ====== Standard Library Imports ======
from enum import StrEnum


class XaiMethod(StrEnum):
    """
    Enumeration of supported XAI (explainability) methods.

    Attributes:
        GRADCAM (str): Use Grad-CAM for visual explanation.
        LIME (str): Use LIME (Local Interpretable Model-Agnostic Explanations).
    """
    GRADCAM = "gradcam"
    LIME = "lime"
