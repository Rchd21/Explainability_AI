# ====== Code Summary ======
# Defines a Pydantic model for the output of a lung cancer prediction, including the
# classification decision, score, and threshold used for determining the result.


# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field


class LungPrediction(BaseModel):
    """
    Structured result of a lung cancer prediction.

    Attributes:
        decision (str): Human-readable classification decision.
        threshold (float): Threshold used to determine positive classification.
        score (float): Model confidence score for the target class.
    """
    decision: str = Field(..., description="Human-readable classification decision.")
    threshold: float = Field(..., description="Threshold used to determine positive classification.")
    score: float = Field(..., description="Model confidence score for the target class.")
