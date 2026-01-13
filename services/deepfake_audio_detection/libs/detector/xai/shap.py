# shap.py
from __future__ import annotations

# ====== Standard Library Imports ======
import warnings
from uuid import uuid4

# ====== Third-Party Imports ======
import numpy as np
import tensorflow as tf
import shap

# ====== Local Project Imports ======
from .base import XaiBase
from .overlay_config import OverlayConfig
from .helpers import XaiHelpers


class XaiShap(XaiBase):
    """Explain image-like inputs using SHAP with robust fallbacks.

    This explainer returns a display-ready visualization:
      - Primary: SHAP signed overlay for the selected class
          red = positive contribution
          blue = negative contribution
      - Fallback 1: gradient-based unsigned importance overlay
      - Fallback 2: base image converted to RGB uint8

    The SHAP explainer is cached per input shape to avoid repeated masker/explainer construction.
    """

    _shap_max_evals: int
    _shap_batch_size: int
    _masker_mode: str

    _wrapped_model: tf.keras.Model
    _explainer: shap.Explainer | None
    _explainer_input_shape: tuple[int, int, int] | None

    def __init__(
            self,
            model: tf.keras.Model,
            *,
            shap_max_evals: int = 256,
            shap_batch_size: int = 16,
            masker: str = "blur(32,32)",
    ) -> None:
        """Initialize the SHAP explainer.

        Args:
            model (tf.keras.Model): Model to explain. If the model has multiple outputs, the first
                output is used.
            shap_max_evals (int): Maximum SHAP evaluations (clamped to at least 64).
            shap_batch_size (int): SHAP batch size (clamped to at least 1).
            masker (str): SHAP image masker mode string (e.g., "blur(32,32)").

        Raises:
            ValueError: If the model has no outputs or parameters are invalid.
        """
        super().__init__(model)

        self._shap_max_evals = max(64, int(shap_max_evals))
        self._shap_batch_size = max(1, int(shap_batch_size))
        self._masker_mode = str(masker)

        self._wrapped_model = self._ensure_single_tensor_output(model)
        self._explainer = None
        self._explainer_input_shape = None

        self.logger.info(
            "Initialized XaiShap "
            f"(shap_max_evals={self._shap_max_evals}, shap_batch_size={self._shap_batch_size}, "
            f"masker={self._masker_mode})"
        )

    @staticmethod
    def _ensure_single_tensor_output(model: tf.keras.Model) -> tf.keras.Model:
        """Wrap a model so it has exactly one tensor output.

        Args:
            model (tf.keras.Model): Input model.

        Returns:
            tf.keras.Model: A wrapped model with a single output tensor.

        Raises:
            ValueError: If the model has no outputs.
        """
        outputs = model.outputs
        if isinstance(outputs, (list, tuple)):
            if len(outputs) == 0:
                raise ValueError("Model has no outputs.")
            outputs = outputs[0]
        return tf.keras.Model(inputs=model.inputs, outputs=outputs)

    def _predict_np(self, x: np.ndarray) -> np.ndarray:
        """Predict function for SHAP.

        SHAP calls this function repeatedly. It must return an array shaped (B, C).

        Args:
            x (np.ndarray): Input image(s), shape (H, W, C) or (B, H, W, C).

        Returns:
            np.ndarray: Predictions, shape (B, C).
        """
        x01 = XaiHelpers.as_float01(x)
        if x01.ndim == 3:
            x01 = np.expand_dims(x01, axis=0)

        out = self._wrapped_model.predict(x01, verbose=0)
        out_np = np.asarray(out)

        if out_np.ndim == 1:
            out_np = np.expand_dims(out_np, axis=0)

        return out_np

    def _get_or_create_explainer(self, input_shape: tuple[int, int, int]) -> shap.Explainer:
        """Get a cached SHAP explainer for the given input shape or create a new one.

        Args:
            input_shape (tuple[int, int, int]): Image shape (H, W, C).

        Returns:
            shap.Explainer: A SHAP explainer bound to the given image shape.
        """
        if self._explainer is not None and self._explainer_input_shape == input_shape:
            return self._explainer

        self.logger.debug(
            f"PROGRESS creating SHAP Image masker explainer (shape={input_shape}, mode={self._masker_mode})"
        )

        masker = shap.maskers.Image(self._masker_mode, input_shape)
        explainer = shap.Explainer(self._predict_np, masker)

        self._explainer = explainer
        self._explainer_input_shape = input_shape
        return explainer

    def _select_valid_class_index(self, preds_2d: np.ndarray, requested_index: int) -> int:
        """Select a safe class index given prediction output.

        Args:
            preds_2d (np.ndarray): Predictions shaped (B, C).
            requested_index (int): Requested class index.

        Returns:
            int: A valid class index (falls back to argmax if out of range).
        """
        idx = int(requested_index)
        num_classes = int(preds_2d.shape[-1])
        if 0 <= idx < num_classes:
            return idx
        return int(np.argmax(preds_2d[0]))

    def _shap_signed_map(self, base_image: np.ndarray, class_index: int) -> np.ndarray:
        """Compute a signed 2D SHAP heatmap for the selected class.

        Args:
            base_image (np.ndarray): Base image to explain.
            class_index (int): Target class index (falls back to argmax if SHAP provides multi-class values).

        Returns:
            np.ndarray: Signed heatmap shaped (H, W), dtype float32.

        Raises:
            ValueError: If SHAP returns unexpected shapes.
        """
        x01 = XaiHelpers.as_float01(XaiHelpers.ensure_rgb(base_image))
        height, width, channels = (int(x01.shape[0]), int(x01.shape[1]), int(x01.shape[2]))

        explainer = self._get_or_create_explainer((height, width, channels))
        xb = np.expand_dims(x01, axis=0)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            exp = explainer(
                xb,
                max_evals=self._shap_max_evals,
                batch_size=self._shap_batch_size,
            )

        vals = np.asarray(exp.values)

        # Typical SHAP shapes:
        # - Multi-class: (B, H, W, C, K)
        # - Single-output: (B, H, W, C)
        if vals.ndim == 5:
            # Validate/fallback class index against model predictions (more robust than hard-raising).
            preds = self._predict_np(x01)
            ci = self._select_valid_class_index(preds, int(class_index))

            if ci < 0 or ci >= int(vals.shape[-1]):
                raise ValueError(f"SHAP returned K={int(vals.shape[-1])} classes but selected ci={ci} is invalid.")

            v = vals[0, :, :, :, ci]  # (H, W, C)
        elif vals.ndim == 4:
            v = vals[0]  # (H, W, C)
        else:
            raise ValueError(f"Unexpected SHAP values shape: {vals.shape} (expected 4D or 5D).")

        signed = np.mean(v, axis=-1).astype(np.float32)  # (H, W)
        return signed

    def _gradient_fallback_unsigned(self, base_image: np.ndarray, class_index: int) -> np.ndarray:
        """Compute an unsigned gradient-based importance map as a fallback.

        Args:
            base_image (np.ndarray): Base image to explain.
            class_index (int): Target class index (must be valid for the model output).

        Returns:
            np.ndarray: Importance map in [0, 1], shape (H, W), dtype float32.

        Raises:
            ValueError: If model output rank is unexpected or class index is out of range.
            RuntimeError: If gradients cannot be computed.
        """
        x01 = XaiHelpers.as_float01(XaiHelpers.ensure_rgb(base_image))
        x_tf = tf.Variable(x01[None, ...])

        with tf.GradientTape() as tape:
            preds = self._wrapped_model(x_tf, training=False)
            preds = tf.convert_to_tensor(preds)

            if preds.shape.rank != 2:
                raise ValueError(f"Unexpected output rank: {preds.shape.rank}. Expected (B, C).")

            ci = int(class_index)
            num_classes = int(preds.shape[-1])
            if ci < 0 or ci >= num_classes:
                raise ValueError(f"class_index out of range: {ci} (num_classes={num_classes})")

            score = preds[:, ci]

        grads = tape.gradient(score, x_tf)
        if grads is None:
            raise RuntimeError("GradientTape returned None gradients.")

        imp = tf.reduce_mean(tf.abs(grads), axis=-1)[0]  # (H, W)
        imp = imp / (tf.reduce_max(imp) + 1e-8)
        return imp.numpy().astype(np.float32)

    def explain(
            self,
            x: np.ndarray,
            class_index: int,
            base_image: np.ndarray,
            overlay_cfg: OverlayConfig,
    ) -> np.ndarray:
        """Generate a SHAP overlay explanation with fallbacks.

        Args:
            x (np.ndarray): Input sample (accepted for API consistency; not used directly as SHAP
                operates on `base_image`).
            class_index (int): Target class index.
            base_image (np.ndarray): Image to explain (RGB-like).
            overlay_cfg (OverlayConfig): Overlay rendering configuration.

        Returns:
            np.ndarray: Display-ready RGB image. If SHAP works, returns a signed overlay; if not,
                returns an unsigned gradient overlay; if that fails, returns base image as RGB uint8.
        """
        run_id = uuid4().hex
        _ = x

        self.logger.info(f"START generating SHAP overlay (run_id={run_id}, class_index={int(class_index)})")
        try:
            try:
                signed = self._shap_signed_map(base_image=base_image, class_index=class_index)
                result = XaiHelpers.render_signed_overlay(
                    base_image=base_image,
                    signed_heat=signed,
                    cfg=overlay_cfg,
                )
                self.logger.info(f"END generating SHAP overlay (run_id={run_id}, mode=shap)")
                return result
            except Exception as shap_exc:
                self.logger.error(
                    f"PROGRESS SHAP explanation failed; falling back to gradients "
                    f"(run_id={run_id}, exc_type={type(shap_exc).__name__}, message={str(shap_exc)})"
                )

            imp = self._gradient_fallback_unsigned(base_image=base_image, class_index=class_index)
            result = XaiHelpers.render_unsigned_overlay(
                base_image=base_image,
                importance01=imp,
                cfg=overlay_cfg,
            )
            self.logger.info(f"END generating SHAP overlay (run_id={run_id}, mode=gradient_fallback)")
            return result

        except Exception as grad_exc:
            self.logger.error(
                f"END generating SHAP overlay with failure "
                f"(run_id={run_id}, exc_type={type(grad_exc).__name__}, message={str(grad_exc)})"
            )
            return XaiHelpers.ensure_rgb_uint8(base_image)
