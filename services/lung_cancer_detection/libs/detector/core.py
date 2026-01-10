from loggerplusplus import LoggerClass

import numpy as np

from .xai import XaiLime, XaiGradCAM
from .model import LungDetectorModel
from public_models.detector import XaiMethod, DetectorResult, LungPrediction


class LungCancerDetector(LoggerClass):
    target_label: str = "Lung Lesion"

    def __init__(self, model: LungDetectorModel):
        super().__init__()
        self._model: LungDetectorModel = model

        self.logger.info("[LUNG_DETECTOR] Initialized")

    def load_model(self) -> None:
        self.logger.info("[LUNG_DETECTOR] Loading model")
        self._model.load_model()
        self.logger.info("[LUNG_DETECTOR] Model loaded")

    def detect(self, image_path: str, xai_method: XaiMethod) -> DetectorResult:
        self.logger.info(
            f"[LUNG_DETECTOR] Detection started | "
            f"xai_method={xai_method} | "
            f"image_path={image_path}"
        )

        # 1) Preprocess
        self.logger.debug("[LUNG_DETECTOR] Preprocessing image")
        x, explain_image_base = self._model.preprocess(image_path)

        # 2) Prediction
        self.logger.debug("[LUNG_DETECTOR] Running prediction")
        prediction: LungPrediction = self._model.predict(x)

        self.logger.info(
            f"[LUNG_DETECTOR] Prediction completed | "
            f"score={prediction.score}"
        )

        # 3) XAI
        self.logger.debug(
            f"[LUNG_DETECTOR] Running XAI | method={xai_method}"
        )

        if xai_method == XaiMethod.GRADCAM:
            explainer = XaiGradCAM(model=self._model.model)

        elif xai_method == XaiMethod.LIME:
            explainer = XaiLime(model=self._model.model)

        else:
            self.logger.error(
                f"[LUNG_DETECTOR] Unknown XAI method: {xai_method}"
            )
            raise ValueError(f"Unknown XAI method: {xai_method}")

        xai_explain: np.ndarray = explainer.explain(
            x=x,
            target_label=self.target_label,
            base_image=explain_image_base
        )

        self.logger.info(
            f"[LUNG_DETECTOR] XAI completed | "
            f"method={xai_method}"
        )

        return DetectorResult(
            xai_method=xai_method,
            xai_explain=xai_explain.tolist(),
            lung_prediction=prediction,
        )
