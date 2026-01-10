# ====== Code Summary ======
# This module defines a LungDetectorModel used to perform inference on chest X-ray images using
# the TorchXRayVision DenseNet model. It includes image preprocessing, multi-label prediction,
# and a proxy decision for lung cancer detection based on configured pathology keys.

from __future__ import annotations

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass
import numpy as np
import torch
import torchxrayvision as xrv
import skimage.io

# ====== Internal Project Imports ======
from public_models.detector import LungPrediction

# ====== Local Project Imports ======
from .helpers import DetectorHelpers


class LungDetectorModel(LoggerClass):
    target_label: str = "Lung Lesion"

    """
    Détection (inférence) uniquement :
    - Chargement modèle TorchXRayVision
    - Preprocess X-ray
    - Prédiction multi-label
    - Décision proxy cancer (Lung Lesion)
    """

    def __init__(
            self,
            weights: str,
            threshold: float,
    ) -> None:
        """
        Initialize the lung detector model.

        Args:
            weights (str): Path or identifier to model weights.
            threshold (float): Threshold for cancer suspicion decision.
        """
        super().__init__()

        self._device: torch.device = DetectorHelpers.auto_device_detect()
        self._weights: str = weights
        self._threshold: float = threshold
        self.model: None | torch.nn.Module = None

        self.logger.info("Initialized LungDetectorModel")
        self.logger.debug(f"Device: {self._device}, Threshold: {self._threshold}")

    def load_model(self) -> None:
        """
        Loads the TorchXRayVision DenseNet model onto the configured device.
        """
        self.logger.info(f"Loading model with weights: {self._weights}")
        model = xrv.models.DenseNet(weights=self._weights)
        model = model.to(self._device)
        model.eval()
        self.model = model
        self.logger.info("Model loaded and set to evaluation mode.")

    def preprocess(self, image_path: str) -> tuple[torch.Tensor, np.ndarray]:
        """
        TorchXRayVision preprocess with explainable image output.

        Returns:
            x (torch.Tensor): Model input tensor [1,1,224,224], normalized for XRV
            img_explain (np.ndarray): Grayscale image [224,224] in [0,1] for XAI overlay
        """
        self.logger.info(f"Preprocessing image: {image_path}")

        # 1. Read image
        img = skimage.io.imread(image_path)
        self.logger.debug(f"Original image shape: {img.shape}")

        # 2. Convert to grayscale if RGB (DO THIS FIRST)
        if img.ndim == 3:
            img = img.mean(axis=2)
            self.logger.debug("Converted RGB image to grayscale.")

        # 3. Create explainable copy BEFORE normalization
        img_explain = img.astype(np.float32)

        # Normalize explain image to [0,1] for display
        if img_explain.max() > 1.0:
            img_explain = img_explain / 255.0
        img_explain = np.clip(img_explain, 0.0, 1.0)

        # 4. Prepare model image (copy)
        img_model = img_explain.copy()

        # 5. Normalize as XRV expects (MODEL ONLY)
        img_model = xrv.datasets.normalize(img_model, 1.0)

        # 6. Add channel dimension (1, H, W)
        img_model = img_model[np.newaxis, :, :]
        img_explain = img_explain[np.newaxis, :, :]

        # 7. Center crop and resize (APPLY TO BOTH!)
        crop = xrv.datasets.XRayCenterCrop()
        resize = xrv.datasets.XRayResizer(224)

        img_model = resize(crop(img_model))
        img_explain = resize(crop(img_explain))

        # 8. Convert model image to tensor and add batch dimension
        x = torch.from_numpy(img_model).unsqueeze(0).float().to(self._device)

        # 9. Remove channel dim for explain image → [224,224]
        img_explain = img_explain.squeeze().astype(np.float32)

        self.logger.debug(f"Model tensor shape: {x.shape}")
        self.logger.debug(f"Explain image shape: {img_explain.shape}")

        return x, img_explain

    def predict_scores(self, x: torch.Tensor) -> dict[str, float]:
        """
        Run the model on the input tensor and return scores for each pathology.

        Args:
            x (torch.Tensor): Preprocessed image tensor.

        Returns:
            dict[str, float]: dictionary mapping pathology names to their predicted scores.
        """
        self.logger.info("Predicting pathology scores.")
        with torch.no_grad():
            out = self.model(x)[0].detach().cpu().numpy()
        scores = {k: float(v) for k, v in zip(self.model.pathologies, out)}
        self.logger.debug(f"Predicted scores: {scores}")
        return scores

    def predict(self, x: torch.Tensor) -> LungPrediction:
        """
        Predicts whether cancer is suspected from the image.

        Args:
            x (torch.Tensor): Preprocessed image tensor.

        Returns:
            LungPrediction: Structured result containing decision, scores, and metadata.
        """
        self.logger.info("Generating final prediction.")
        # 1. Run model and collect pathology scores
        scores = self.predict_scores(x)

        # 2. Extract relevant cancer scores
        cancer_score = float(scores[self.target_label])
        self.logger.debug(f"Confidence score: {cancer_score}")

        # 3. Determine decision
        decision = "Cancer suspected" if cancer_score >= self._threshold else "No cancer detected"
        self.logger.info(f"Decision: {decision} (score: {cancer_score}, threshold: {self._threshold})")

        # 4. Return result
        return LungPrediction(
            decision=decision,
            threshold=self._threshold,
            score=cancer_score,
        )
