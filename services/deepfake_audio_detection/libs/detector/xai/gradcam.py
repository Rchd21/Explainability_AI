# ====== Code Summary ======
# Streamlit-faithful Grad-CAM explainer using VGG16 pretrained on ImageNet.
# It ignores the audio classifier and mimics legacy behavior from the Streamlit prototype.
# Produces a class heatmap overlay for a base spectrogram image.

# ====== Standard Library Imports ======
from __future__ import annotations

# ====== Third-Party Library Imports ======
import numpy as np
import tensorflow as tf
import cv2
from keras.preprocessing.image import img_to_array

# ====== Local Project Imports ======
from .base import XaiBase


class XaiGradCAM(XaiBase):
    """
    Streamlit-faithful implementation of your Grad-CAM block.

    IMPORTANT:
    This is NOT Grad-CAM applied to your audio classifier.
    It reproduces exactly what the Streamlit app does:
    - Uses a VGG16 ImageNet model (include_top=True)
    - Extracts features from layer 'block5_conv3'
    - Generates heatmap for class index
    - Overlays heatmap on the preprocessed base image using cv2.addWeighted
    """

    def __init__(self, model: tf.keras.Model) -> None:
        """
        Initialize the VGG-based Grad-CAM explainer.
        Although a model is passed to stay consistent with other explainers, it's not used.

        Args:
            model (tf.keras.Model): Unused. Only provided to match other explainer signatures.
        """
        super().__init__(model)

        # Load and cache VGG16 model with ImageNet weights
        self._vgg = tf.keras.applications.VGG16(weights="imagenet", include_top=True)
        self._last_conv_layer = self._vgg.get_layer("block5_conv3")

        # Build gradient model for Grad-CAM
        self._grad_model = tf.keras.models.Model(
            inputs=[self._vgg.inputs],
            outputs=[self._last_conv_layer.output, self._vgg.output],
        )

        self.logger.info("Initialized XaiGradCAM (Streamlit-faithful VGG16 heatmap)")

    def explain(self, x: np.ndarray, class_index: int, base_image: np.ndarray) -> np.ndarray:
        """
        Generate a Grad-CAM explanation over the given base image using a fixed VGG16 model.

        Args:
            x (np.ndarray): Unused input. Only kept to match signature.
            class_index (int): Class index to explain (e.g., 0 = real, 1 = fake).
            base_image (np.ndarray): Original spectrogram image in 0..255, shape (H, W, 3).

        Returns:
            np.ndarray: RGB image with heatmap overlay (uint8).
        """
        class_idx = int(class_index)

        # 1. Preprocess input as in Streamlit: expand dims, convert to float, normalize
        img_array = img_to_array(base_image)
        vgg_x = np.expand_dims(img_array, axis=0)
        vgg_x = tf.keras.applications.vgg16.preprocess_input(vgg_x)

        # 2. Compute gradients of the class output w.r.t. conv layer
        with tf.GradientTape() as tape:
            last_conv_out, preds = self._grad_model(vgg_x)
            class_output = preds[:, class_idx]

        grads = tape.gradient(class_output, last_conv_out)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

        # 3. Generate heatmap
        last_conv_out = last_conv_out[0]  # shape: (H, W, C)
        heatmap = last_conv_out @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)  # shape: (H, W)

        # 4. Normalize heatmap to [0, 1]
        heatmap = tf.maximum(heatmap, 0) / (tf.reduce_max(heatmap) + 1e-8)

        # 5. Resize heatmap to image shape
        heatmap = cv2.resize(np.float32(heatmap), (vgg_x.shape[2], vgg_x.shape[1]))

        # 6. Colorize heatmap using JET colormap
        heatmap = np.uint8(255 * heatmap)
        heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET).astype(np.float32)

        # 7. Overlay heatmap onto original input using OpenCV blending
        overlay = cv2.addWeighted(
            vgg_x[0].astype(np.float32),
            0.6,
            heatmap,
            0.4,
            0,
            dtype=cv2.CV_32F,
        )

        # 8. Clip and convert to uint8 image
        overlay = np.clip(overlay, 0, 255).astype(np.uint8)
        return overlay
