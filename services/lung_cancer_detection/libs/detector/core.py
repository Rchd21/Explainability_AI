# ====== Code Summary ======
# Implements the core logic for lung cancer detection, including model inference and explainability (XAI) support.
# Wraps a detection model and provides structured output using configurable XAI methods (GradCAM or LIME).


# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass
import numpy as np

# ====== Local Project Imports ======
from public_models.detector import (
    XaiMethod,
    DetectorResult,
    LungPrediction
)

# ====== Internal Project Imports ======
from .xai import XaiLime, XaiGradCAM
from .model import LungDetectorModel


class LungCancerDetector(LoggerClass):
    """
    Main class responsible for lung cancer detection and explainability (XAI) generation.

    Attributes:
        target_label (str): The class label used as the detection target.
    """

    target_label: str = "Lung Lesion"

    def __init__(self, model: LungDetectorModel) -> None:
        """
        Initialize the detector with a specific model instance.

        Args:
            model (LungDetectorModel): An instance of the wrapped lung detection model.
        """
        super().__init__()
        self._model: LungDetectorModel = model

        self.logger.info("[LUNG_DETECTOR] Initialized")

    def load_model(self) -> None:
        """
        Load the underlying model from disk or checkpoint.
        """
        self.logger.info("[LUNG_DETECTOR] Loading model")
        self._model.load_model()
        self.logger.info("[LUNG_DETECTOR] Model loaded")

    def detect(self, image_path: str, xai_method: XaiMethod) -> DetectorResult:
        """
        Run lung cancer detection and explainability (XAI) on a given image.

        Args:
            image_path (str): Path to the image file to analyze.
            xai_method (XaiMethod): Explainability method to apply (e.g., GradCAM or LIME).

        Returns:
            DetectorResult: Structured output including prediction, XAI method, and explanation data.
        """
        self.logger.info(
            f"[LUNG_DETECTOR] Detection started | "
            f"xai_method={xai_method} | "
            f"image_path={image_path}"
        )

        # 1. Preprocess the input image
        self.logger.debug("[LUNG_DETECTOR] Preprocessing image")
        x, explain_image_base = self._model.preprocess(image_path)

        # 2. Run model prediction
        self.logger.debug("[LUNG_DETECTOR] Running prediction")
        prediction: LungPrediction = self._model.predict(x)

        self.logger.info(
            f"[LUNG_DETECTOR] Prediction completed | "
            f"score={prediction.score}"
        )

        # 3. Run explainability (XAI)
        self.logger.debug(f"[LUNG_DETECTOR] Running XAI | method={xai_method}")

        if xai_method == XaiMethod.GRADCAM:
            explainer = XaiGradCAM(model=self._model.model)
        elif xai_method == XaiMethod.LIME:
            explainer = XaiLime(model=self._model.model)
        else:
            self.logger.error(f"[LUNG_DETECTOR] Unknown XAI method: {xai_method}")
            raise ValueError(f"Unknown XAI method: {xai_method}")

        xai_explain: np.ndarray = explainer.explain(
            x=x,
            target_label=self.target_label,
            base_image=explain_image_base
        )

        self.logger.info(
            f"[LUNG_DETECTOR] XAI completed | method={xai_method}"
        )

        # 4. Return results in structured format
        return DetectorResult(
            xai_method=xai_method,
            xai_explain=xai_explain.tolist(),
            lung_prediction=prediction,
        )
