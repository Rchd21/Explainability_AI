# ====== Code Summary ======
# Pydantic model defining the complete result of deepfake audio detection.

from pydantic import BaseModel

from .xai_method import XaiMethod
from .prediction import AudioPrediction


class DetectorResult(BaseModel):
    """
    Complete result from the deepfake audio detector.

    xai_explain is an RGB image serialized as a nested list:
      [height][width][3] with uint8-like ints (0..255)
    """
    xai_method: XaiMethod
    xai_explain: list[list[list[int]]]
    audio_prediction: AudioPrediction
