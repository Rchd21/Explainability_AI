from dataclasses import dataclass


@dataclass
class LungPrediction:
    decision: str
    threshold: float
    score: float
