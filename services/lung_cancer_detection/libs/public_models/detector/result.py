from pydantic import BaseModel

from .xai_method import XaiMethod
import numpy as np
from .prediction import LungPrediction


class DetectorResult(BaseModel):
    xai_method: XaiMethod
    xai_explain: list[list[list[float]]] # [x, y, [R, G, B]
    lung_prediction: LungPrediction
