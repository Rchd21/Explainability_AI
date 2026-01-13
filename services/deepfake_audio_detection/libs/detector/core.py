# ====== Code Summary ======
# Core class responsible for orchestrating fake audio detection.
# Handles model loading, prediction, XAI explanation generation, and spectrogram cleanup.

# ====== Standard Library Imports ======
from __future__ import annotations

import os

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass
import numpy as np

# ====== Internal Project Imports ======
from public_models.detector import XaiMethod, DetectorResult, AudioPrediction

# ====== Local Project Imports ======
from .model import AudioDetectorModel
from .xai import (
    XaiGradCAM,
    XaiLime,
    XaiShap,
    OverlayConfig
)


class FakeAudioDetector(LoggerClass):
    """
    Main orchestrator for deepfake audio detection.

    Attributes:
        _model (AudioDetectorModel): The underlying audio classification model used for detection.
    """

    def __init__(self, model: AudioDetectorModel) -> None:
        """
        Initialize the detector with a provided model.

        Args:
            model (AudioDetectorModel): Instance of the audio detection model.
        """
        super().__init__()
        self._model: AudioDetectorModel = model
        self.logger.info("[AUDIO_DETECTOR] Initialized")

    def load_model(self) -> None:
        """
        Explicitly load the model into memory.
        """
        self.logger.info("[AUDIO_DETECTOR] Loading model")
        self._model.load_model()
        self.logger.info("[AUDIO_DETECTOR] Model loaded")

    def _ensure_model_loaded(self) -> None:
        """
        Internal check to ensure model is loaded before performing operations.
        """
        if self._model.model is None:
            self.logger.warning("[AUDIO_DETECTOR] Model not loaded -> auto-loading")
            self._model.load_model()

    def detect(self, audio_path: str, xai_method: XaiMethod) -> DetectorResult:
        """
        Perform detection on a given audio file and return the result with explanation.

        Args:
            audio_path (str): Path to the input audio file.
            xai_method (XaiMethod): Selected method for XAI explanation (e.g., GRADCAM, LIME, SHAP).

        Returns:
            DetectorResult: The detection result including prediction and explanation data.
        """
        self.logger.info(
            f"[AUDIO_DETECTOR] Detection started | xai_method={xai_method} | audio_path={audio_path}"
        )

        # 1. Ensure model is loaded
        self._ensure_model_loaded()

        # 2. Preprocess audio -> extract spectrogram and intermediate image
        self.logger.debug("[AUDIO_DETECTOR] Preprocessing audio")
        x, explain_image, spectrogram_path = self._model.preprocess(audio_path)

        # 3. Run prediction
        self.logger.debug("[AUDIO_DETECTOR] Running prediction")
        prediction: AudioPrediction = self._model.predict(x)

        self.logger.info(
            f"[AUDIO_DETECTOR] Prediction completed | "
            f"label={prediction.label} | confidence={prediction.confidence:.4f}"
        )

        # 4. Run explanation method (XAI)
        self.logger.debug(f"[AUDIO_DETECTOR] Running XAI | method={xai_method}")

        if self._model.model is None:
            raise RuntimeError("Internal error: model should be loaded but is None.")

        # 4a. Select appropriate XAI explainer
        if xai_method == XaiMethod.GRADCAM:
            explainer = XaiGradCAM(model=self._model.model)
        elif xai_method == XaiMethod.LIME:
            explainer = XaiLime(model=self._model.model)
        elif xai_method == XaiMethod.SHAP:
            explainer = XaiShap(model=self._model.model)
        else:
            raise ValueError(f"Unknown XAI method: {xai_method}")

        # 4b. Generate XAI explanation
        xai_explain: np.ndarray = explainer.explain(
            x=x,
            class_index=prediction.class_index,
            base_image=explain_image,
            overlay_cfg=OverlayConfig()
        )

        self.logger.info(f"[AUDIO_DETECTOR] XAI completed | method={xai_method}")

        # 5. Cleanup temporary spectrogram file
        try:
            if spectrogram_path and os.path.exists(spectrogram_path):
                os.remove(spectrogram_path)
                self.logger.debug(f"[AUDIO_DETECTOR] Cleaned up spectrogram: {spectrogram_path}")
        except OSError as e:
            self.logger.warning(f"[AUDIO_DETECTOR] Failed to cleanup spectrogram: {e}")

        # 6. Return detection result
        return DetectorResult(
            xai_method=xai_method,
            xai_explain=xai_explain.tolist(),
            audio_prediction=prediction,
        )
