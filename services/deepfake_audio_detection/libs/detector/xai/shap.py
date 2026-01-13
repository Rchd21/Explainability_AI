from __future__ import annotations

import warnings
from typing import Optional, Tuple

import numpy as np
import tensorflow as tf
import cv2
import shap
from matplotlib.colors import LinearSegmentedColormap

from .base import XaiBase


class XaiShap(XaiBase):
    """
    Robust SHAP visual explainer for spectrogram classification.

    Why this implementation:
    - shap.GradientExplainer / DeepExplainer can crash with TF/Keras when shapes include None.
    - We use the model-agnostic SHAP Explainer with an Image masker (real SHAP values).
    - Fallback: gradient saliency.
    - Never-throw: returns original image if everything fails.
    """

    def __init__(
        self,
        model: tf.keras.Model,
        num_background: int = 50,
        shap_max_evals: int = 256,
        shap_batch_size: int = 16,
        masker: str = "blur(16,16)",
    ) -> None:
        super().__init__(model)
        self._num_background = max(1, int(num_background))

        # SHAP model-agnostic knobs (speed vs quality)
        self._shap_max_evals = max(64, int(shap_max_evals))
        self._shap_batch_size = max(1, int(shap_batch_size))
        self._masker_mode = str(masker)

        # Ensure model output is a single tensor (not dict/list)
        self._wrapped_model = self._ensure_single_tensor_output(model)

        # Cache explainer (created lazily once we know the input shape)
        self._explainer: Optional[shap.Explainer] = None
        self._explainer_input_shape: Optional[Tuple[int, int, int]] = None

    # -------------------------
    # Model wrapping
    # -------------------------
    @staticmethod
    def _ensure_single_tensor_output(model: tf.keras.Model) -> tf.keras.Model:
        outputs = model.outputs
        if isinstance(outputs, (list, tuple)):
            if len(outputs) == 0:
                raise ValueError("Model has no outputs.")
            outputs = outputs[0]
        return tf.keras.Model(inputs=model.inputs, outputs=outputs)

    # -------------------------
    # Input utilities
    # -------------------------
    @staticmethod
    def _normalize_input(x: np.ndarray) -> np.ndarray:
        x = x.astype(np.float32, copy=False)
        if x.max() > 1.0:
            x = x / 255.0
        return x

    def _predict_np(self, x: np.ndarray) -> np.ndarray:
        """
        Numpy -> numpy predict function for SHAP.
        SHAP expects: (B,H,W,C) -> (B, num_classes)
        """
        x = self._normalize_input(x)
        if x.ndim == 3:
            x = np.expand_dims(x, axis=0)

        out = self._wrapped_model.predict(x, verbose=0)
        out = np.asarray(out)

        # Ensure 2D output (B, C)
        if out.ndim == 1:
            out = np.expand_dims(out, axis=0)

        return out

    # -------------------------
    # SHAP (model-agnostic, image masker)
    # -------------------------
    def _get_or_create_explainer(self, input_shape: Tuple[int, int, int]) -> shap.Explainer:
        """
        Create a SHAP Explainer with an Image masker for the given input shape.
        Cached per input shape.
        """
        if self._explainer is not None and self._explainer_input_shape == input_shape:
            return self._explainer

        self.logger.debug(f"[XAI_SHAP] Creating SHAP image masker explainer for shape={input_shape} mode={self._masker_mode}")

        # Image masker: blur is fast and stable. (inpaint_telea can work too but depends on OpenCV build)
        masker = shap.maskers.Image(self._masker_mode, input_shape)

        # Model-agnostic explainer (will pick a suitable algorithm internally)
        explainer = shap.Explainer(self._predict_np, masker)

        self._explainer = explainer
        self._explainer_input_shape = input_shape
        return explainer

    def _shap(self, base_image: np.ndarray, class_index: int) -> np.ndarray:
        """
        Compute SHAP values using an image masker explainer.
        Returns a 2D importance map in [0,1].
        """
        self.logger.debug("[XAI_SHAP] Attempting SHAP explanation (masker-based)")

        x = self._normalize_input(base_image)
        if x.ndim != 3:
            raise ValueError(f"base_image must be HWC, got shape={x.shape}")
        h, w, c = x.shape

        explainer = self._get_or_create_explainer((h, w, c))

        # SHAP expects batch
        xb = np.expand_dims(x, axis=0)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")

            # Compute explanations (speed/quality tradeoff controlled by max_evals)
            exp = explainer(
                xb,
                max_evals=self._shap_max_evals,
                batch_size=self._shap_batch_size,
            )

        # exp.values shape can be:
        # - (B, H, W, C, num_outputs)  for multi-class outputs
        # - (B, H, W, C)              for single output
        vals = np.asarray(exp.values)

        class_index = int(class_index)

        if vals.ndim == 5:
            if class_index < 0 or class_index >= vals.shape[-1]:
                raise ValueError(f"class_index={class_index} out of range for SHAP values last dim={vals.shape[-1]}")
            v = vals[0, :, :, :, class_index]  # (H, W, C)
        elif vals.ndim == 4:
            v = vals[0]  # (H, W, C)
        else:
            raise ValueError(f"Unexpected SHAP values shape: {vals.shape}")

        imp = np.mean(np.abs(v), axis=-1).astype(np.float32)  # (H,W)
        mx = float(imp.max())
        if mx > 0:
            imp = imp / mx

        self.logger.debug("[XAI_SHAP] SHAP explanation succeeded (masker-based)")
        return imp

    # -------------------------
    # Fallback: gradient saliency
    # -------------------------
    def _gradient_fallback(self, base_image: np.ndarray, class_index: int) -> np.ndarray:
        self.logger.warning("[XAI_SHAP] Falling back to gradient explanation")

        x = self._normalize_input(base_image)
        x = np.expand_dims(x, axis=0)

        x_tf = tf.Variable(x)
        with tf.GradientTape() as tape:
            preds = self._wrapped_model(x_tf, training=False)
            preds = tf.convert_to_tensor(preds)

            if preds.shape.rank != 2:
                raise ValueError(f"Unexpected output rank: {preds.shape}. Expected (B, C).")

            class_index = int(class_index)
            if class_index < 0 or class_index >= int(preds.shape[-1]):
                raise ValueError(f"class_index={class_index} out of range for output {preds.shape}")

            score = preds[:, class_index]

        grads = tape.gradient(score, x_tf)
        if grads is None:
            raise RuntimeError("GradientTape returned None gradients.")

        imp = tf.reduce_mean(tf.abs(grads), axis=-1)[0]
        imp = imp / (tf.reduce_max(imp) + 1e-8)
        return imp.numpy().astype(np.float32)

    # -------------------------
    # Overlay
    # -------------------------
    def _overlay(self, importance: np.ndarray, base_image: np.ndarray) -> np.ndarray:
        base = self._ensure_rgb(base_image)
        base = self._to_uint8(base)

        if importance.ndim != 2:
            raise ValueError(f"importance must be 2D (H,W), got {importance.shape}")

        if importance.shape[:2] != base.shape[:2]:
            importance = cv2.resize(importance.astype(np.float32), (base.shape[1], base.shape[0]))

        cmap = LinearSegmentedColormap.from_list(
            "shap_like",
            [(0.0, 0.0, 1.0), (1.0, 1.0, 1.0), (1.0, 0.0, 0.0)],
            N=256,
        )
        colored = cmap(np.clip(importance, 0, 1))[:, :, :3]
        colored = (colored * 255).astype(np.uint8)

        alpha = 0.5
        out = (alpha * colored.astype(np.float32) + (1.0 - alpha) * base.astype(np.float32))
        return np.clip(out, 0, 255).astype(np.uint8)

    # -------------------------
    # Public API (never-throw)
    # -------------------------
    def explain(self, x: np.ndarray, class_index: int, base_image: np.ndarray) -> np.ndarray:
        self.logger.debug("[XAI_SHAP] Starting explanation")

        # 1) Try SHAP
        try:
            importance = self._shap(base_image, class_index)
        except Exception as e:
            self.logger.exception(f"[XAI_SHAP] SHAP explanation failed: {e}")

            # 2) Fallback gradients
            try:
                importance = self._gradient_fallback(base_image, class_index)
            except Exception as e2:
                self.logger.exception(f"[XAI_SHAP] Gradient fallback failed: {e2}")
                importance = np.zeros(base_image.shape[:2], dtype=np.float32)

        # 3) Overlay (last-resort safe)
        try:
            return self._overlay(importance, base_image)
        except Exception as e3:
            self.logger.exception(f"[XAI_SHAP] Overlay failed: {e3}")
            return self._to_uint8(self._ensure_rgb(base_image))
