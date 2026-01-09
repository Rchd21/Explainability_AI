# services/lung_cancer_detection/detector/lung_detection.py

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torchxrayvision as xrv
import skimage.io


def get_device(prefer: str = "mps") -> torch.device:
    """Prefer MPS on Mac, else CPU. (CUDA not used on Mac)"""
    if prefer == "mps" and torch.backends.mps.is_available():
        return torch.device("mps")
    if prefer == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@dataclass
class LungPrediction:
    decision: str
    cancer_score: float
    used_keys: List[str]
    threshold: float
    scores: Dict[str, float]


class LungDetectorModel:
    """
    Détection (inférence) uniquement :
    - Chargement modèle TorchXRayVision
    - Preprocess X-ray
    - Prédiction multi-label
    - Décision proxy cancer (Lung Lesion)
    """

    def __init__(
        self,
        weights: str = "densenet121-res224-chex",
        threshold: float = 0.5,
        cancer_keys: Optional[List[str]] = None,
        device: Optional[torch.device] = None,
    ):
        self.device = device or get_device("mps")
        self.weights = weights
        self.threshold = threshold
        self.cancer_keys = cancer_keys or ["Lung Lesion"]

        self.model = self._load_model()

    def _load_model(self) -> torch.nn.Module:
        model = xrv.models.DenseNet(weights=self.weights)
        model = model.to(self.device)
        model.eval()
        return model

    def preprocess(self, image_path: str) -> torch.Tensor:
        """
        TorchXRayVision preprocess (correct):
        returns tensor [1,1,224,224] float
        """
        img = skimage.io.imread(image_path)

        # normalize as XRV expects
        img = xrv.datasets.normalize(img, 255)

        # grayscale if RGB
        if img.ndim == 3:
            img = img.mean(2)

        # add channel (1,H,W)
        img = img[np.newaxis, :, :]

        # center crop + resize
        img = xrv.datasets.XRayCenterCrop()(img)
        img = xrv.datasets.XRayResizer(224)(img)

        x = torch.from_numpy(img).unsqueeze(0).float().to(self.device)  # [1,1,224,224]
        return x

    def predict_scores(self, x: torch.Tensor) -> Dict[str, float]:
        """Returns dict pathology->score (float)."""
        with torch.no_grad():
            out = self.model(x)[0].detach().cpu().numpy()
        return {k: float(v) for k, v in zip(self.model.pathologies, out)}

    def predict(self, x: torch.Tensor) -> LungPrediction:
        scores = self.predict_scores(x)

        available = [k for k in self.cancer_keys if k in scores]
        if available:
            cancer_score = float(max(scores[k] for k in available))
            used = available
        else:
            # fallback safe (shouldn't happen, but avoids crashes)
            cancer_score = float(max(scores.values()))
            used = ["<fallback:max_all>"]

        decision = "Cancer suspected" if cancer_score >= self.threshold else "No cancer detected"

        return LungPrediction(
            decision=decision,
            cancer_score=cancer_score,
            used_keys=used,
            threshold=self.threshold,
            scores=scores,
        )
