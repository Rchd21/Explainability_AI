# gradcam.py
from __future__ import annotations

# ====== Standard Library Imports ======
from uuid import uuid4

# ====== Third-Party Imports ======
import cv2
import numpy as np
import tensorflow as tf
from keras.preprocessing.image import img_to_array

# ====== Local Project Imports ======
from .base import XaiBase
from .overlay_config import OverlayConfig
from .helpers import XaiHelpers


class XaiGradCAM(XaiBase):
    """Generate a Grad-CAM visualization using a VGG16/ImageNet proxy model.

    This implementation computes a Grad-CAM-style heatmap from VGG16's last convolution layer
    and overlays a JET colormap heatmap onto a provided `base_image`.

    Notes:
        - The provided `model` is accepted to match the `XaiBase` constructor contract, but this
          Grad-CAM implementation uses VGG16 (ImageNet) as a proxy feature extractor/classifier.
        - `overlay_cfg` is accepted for API consistency but is not used (blending is fixed).

    Attributes:
        _vgg: The VGG16 proxy model loaded with ImageNet weights.
        _last_conv_layer: The last convolutional layer used for Grad-CAM computation.
        _grad_model: A model mapping input images to (conv_output, predictions).
    """

    _vgg: tf.keras.Model
    _last_conv_layer: tf.keras.layers.Layer
    _grad_model: tf.keras.Model

    _BASE_WEIGHT: float = 0.6
    _HEATMAP_WEIGHT: float = 0.4

    def __init__(self, model: tf.keras.Model) -> None:
        """Initialize the Grad-CAM explainer.

        Args:
            model (tf.keras.Model): A model reference required by XaiBase. Not used for Grad-CAM
                computation in this proxy-based implementation.

        Raises:
            ValueError: If the expected VGG16 layer cannot be found.
        """
        super().__init__(model)

        self._vgg = tf.keras.applications.VGG16(weights="imagenet", include_top=True)
        self._last_conv_layer = self._vgg.get_layer("block5_conv3")
        if self._last_conv_layer is None:
            raise ValueError("VGG16 layer 'block5_conv3' not found; cannot compute Grad-CAM.")

        self._grad_model = tf.keras.models.Model(
            inputs=[self._vgg.inputs],
            outputs=[self._last_conv_layer.output, self._vgg.output],
        )

        self.logger.info("Initialized XaiGradCAM (VGG16/ImageNet proxy)")

    @staticmethod
    def _compute_heatmap(
            grad_model: tf.keras.Model,
            vgg_input: np.ndarray,
            class_index: int,
    ) -> np.ndarray:
        """Compute a normalized Grad-CAM heatmap.

        Args:
            grad_model (tf.keras.Model): Model returning (conv_output, predictions).
            vgg_input (np.ndarray): Preprocessed VGG16 input with shape (1, H, W, 3).
            class_index (int): Requested class index. If out of range, falls back to argmax.

        Returns:
            np.ndarray: Heatmap normalized to [0, 1], dtype float32, shape (h, w).

        Raises:
            ValueError: If prediction rank is unexpected.
            RuntimeError: If gradients cannot be computed.
        """
        with tf.GradientTape() as tape:
            conv_out, preds = grad_model(vgg_input)
            preds = tf.convert_to_tensor(preds)

            if preds.shape.rank != 2:
                raise ValueError(f"Unexpected predictions rank: {preds.shape.rank} (expected 2).")

            num_classes = int(preds.shape[-1])
            idx = int(class_index)
            if idx < 0 or idx >= num_classes:
                idx = int(tf.argmax(preds[0]).numpy())

            class_score = preds[:, idx]

        grads = tape.gradient(class_score, conv_out)
        if grads is None:
            raise RuntimeError("Gradients are None (check model graph).")

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))  # (channels,)
        conv_out_0 = conv_out[0]  # (h, w, channels)

        heatmap = conv_out_0 @ pooled_grads[..., tf.newaxis]
        heatmap_np = tf.squeeze(heatmap).numpy()

        heatmap_np = np.maximum(heatmap_np, 0.0)
        heatmap_np = XaiHelpers.normalize_01(heatmap_np).astype(np.float32)
        return heatmap_np

    def explain(
            self,
            x: np.ndarray,
            class_index: int,
            base_image: np.ndarray,
            overlay_cfg: OverlayConfig,
    ) -> np.ndarray:
        """Create a Grad-CAM overlay visualization for the given image.

        Args:
            x (np.ndarray): Input sample. Accepted for API consistency; not used directly since
                this explainer runs a VGG16 proxy on `base_image`.
            class_index (int): Target class index. If invalid, falls back to the top prediction.
            base_image (np.ndarray): Image to visualize. Will be converted to RGB uint8.
            overlay_cfg (OverlayConfig): Accepted for API consistency; not used by this method.

        Returns:
            np.ndarray: RGB uint8 image with the Grad-CAM heatmap overlay applied.

        Raises:
            ValueError: If the base image cannot be interpreted as an image array.
            RuntimeError: If Grad-CAM heatmap computation fails.
        """
        run_id = uuid4().hex

        # Keep API consistent: x and overlay_cfg are not used for this proxy-based implementation.
        _ = x
        _ = overlay_cfg

        self.logger.info(f"START generating Grad-CAM overlay (run_id={run_id}, class_index={class_index})")
        try:
            base_rgb = XaiHelpers.ensure_rgb_uint8(base_image)
            if base_rgb.ndim != 3 or base_rgb.shape[-1] != 3:
                raise ValueError(
                    f"base_image must be convertible to RGB with shape (H, W, 3); got {base_rgb.shape}."
                )

            height, width = int(base_rgb.shape[0]), int(base_rgb.shape[1])
            self.logger.debug(
                f"PROGRESS prepared base image (run_id={run_id}, height={height}, width={width}, dtype={base_rgb.dtype})"
            )

            img_array = img_to_array(base_rgb)
            vgg_x = np.expand_dims(img_array, axis=0)
            vgg_x = tf.keras.applications.vgg16.preprocess_input(vgg_x)

            self.logger.debug(
                f"PROGRESS prepared VGG16 input (run_id={run_id}, shape={tuple(vgg_x.shape)}, dtype={vgg_x.dtype})"
            )

            heatmap = self._compute_heatmap(self._grad_model, vgg_x, class_index=class_index)
            self.logger.debug(
                f"PROGRESS computed heatmap (run_id={run_id}, shape={heatmap.shape}, min={float(np.min(heatmap)):.4f}, "
                f"max={float(np.max(heatmap)):.4f})"
            )

            heatmap_resized = cv2.resize(heatmap, (width, height), interpolation=cv2.INTER_LINEAR)

            hm_u8 = np.uint8(255 * np.clip(heatmap_resized, 0.0, 1.0))
            hm_bgr = cv2.applyColorMap(hm_u8, cv2.COLORMAP_JET)

            base_bgr = cv2.cvtColor(base_rgb, cv2.COLOR_RGB2BGR)
            overlay_bgr = cv2.addWeighted(
                base_bgr,
                self._BASE_WEIGHT,
                hm_bgr,
                self._HEATMAP_WEIGHT,
                0.0,
            )

            result_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)
            self.logger.info(
                f"END generating Grad-CAM overlay (run_id={run_id}, height={height}, width={width})"
            )
            return result_rgb
        except Exception as exc:
            self.logger.error(
                f"END generating Grad-CAM overlay with failure (run_id={run_id}, exc_type={type(exc).__name__}, "
                f"message={str(exc)})"
            )
            raise
