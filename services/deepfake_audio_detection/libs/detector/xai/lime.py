# ====== Code Summary ======
# LIME-based explainer for visualizing which parts of a spectrogram influence deepfake predictions.
# Faithfully replicates the behavior from the original Streamlit prototype using LIME for images.

# ====== Standard Library Imports ======
from __future__ import annotations

# ====== Third-Party Library Imports ======
import numpy as np
import tensorflow as tf
from lime import lime_image
from skimage.segmentation import mark_boundaries

# ====== Local Project Imports ======
from .base import XaiBase


class XaiLime(XaiBase):
    """
    Faithful to Streamlit:
      img_array1 = img_array / 255
      explanation = explainer.explain_instance(img_array1.astype('float64'), model.predict, ...)
      temp, mask = explanation.get_image_and_mask(class, positive_only=False, num_features=8, hide_rest=True)
      mark_boundaries(temp, mask)

    Generates interpretable overlays using LIME for RGB spectrogram inputs.
    """

    def __init__(self, model: tf.keras.Model, num_samples: int = 1000, num_features: int = 8) -> None:
        """
        Initialize the LIME explainer.

        Args:
            model (tf.keras.Model): The TensorFlow model to be explained.
            num_samples (int): Number of perturbed samples to generate for LIME.
            num_features (int): Number of features to highlight in the explanation.
        """
        super().__init__(model)
        self._num_samples = int(num_samples)
        self._num_features = int(num_features)
        self._explainer = lime_image.LimeImageExplainer()

    def _predict_fn(self, images: np.ndarray) -> np.ndarray:
        """
        Internal prediction wrapper for LIME compatibility.

        Args:
            images (np.ndarray): Array of images in float format.

        Returns:
            np.ndarray: Model prediction probabilities.
        """
        # 1. Ensure float32 and normalize if needed
        images = images.astype(np.float32)
        if images.max() > 1.0:
            images = images / 255.0

        # 2. Ensure batch dimension
        if images.ndim == 3:
            images = np.expand_dims(images, axis=0)

        # 3. Run model prediction
        return self._model.predict(images, verbose=0)

    def explain(self, x: np.ndarray, class_index: int, base_image: np.ndarray) -> np.ndarray:
        """
        Generate a LIME explanation for the given class and base image.

        Args:
            x (np.ndarray): Input array (ignored; kept for API consistency).
            class_index (int): Target class to explain (e.g., 0 = real, 1 = fake).
            base_image (np.ndarray): Input image (spectrogram) in range [0, 255].

        Returns:
            np.ndarray: Image with boundaries showing LIME-highlighted regions (uint8 RGB).
        """
        # 1. Normalize image for LIME
        img = base_image.astype(np.float64)
        if img.max() > 1.0:
            img = img / 255.0

        # 2. Run LIME to get explanation
        explanation = self._explainer.explain_instance(
            img,
            self._predict_fn,
            hide_color=0,
            num_samples=self._num_samples,
        )

        # 3. Extract visualization for the target class
        temp, mask = explanation.get_image_and_mask(
            int(class_index),
            positive_only=False,
            num_features=self._num_features,
            hide_rest=True,
        )

        # 4. Overlay boundaries and convert to visual-friendly format
        vis = mark_boundaries(temp, mask)
        vis = self._to_uint8(vis)
        vis = self._ensure_rgb(vis)

        return vis
