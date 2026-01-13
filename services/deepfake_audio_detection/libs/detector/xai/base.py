# ====== Code Summary ======
# Abstract base class for explainable AI (XAI) methods.
# Provides interface and shared utilities for visual explanation generation using TensorFlow models.

# ====== Standard Library Imports ======
from __future__ import annotations

from abc import ABC, abstractmethod

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass
import numpy as np
import tensorflow as tf


class XaiBase(LoggerClass, ABC):
    """
    Abstract base class for XAI (explainable AI) strategies used in audio deepfake detection.

    Attributes:
        _model (tf.keras.Model): TensorFlow model to be explained.
    """

    def __init__(self, model: tf.keras.Model) -> None:
        """
        Initialize the XAI base class with a TensorFlow model.

        Args:
            model (tf.keras.Model): The model instance to generate explanations for.
        """
        super().__init__()
        self._model: tf.keras.Model = model
        self.logger.debug(f"Initialized {self.__class__.__name__}")

    @abstractmethod
    def explain(self, x: np.ndarray, class_index: int, base_image: np.ndarray) -> np.ndarray:
        """
        Generate an explanation heatmap for a given input and predicted class.

        Args:
            x (np.ndarray): Input tensor for the model (e.g., spectrogram).
            class_index (int): Index of the predicted class.
            base_image (np.ndarray): Original visualization image to align with the explanation.

        Returns:
            np.ndarray: Explanation heatmap as a NumPy array.
        """
        raise NotImplementedError

    @staticmethod
    def _ensure_rgb(image: np.ndarray) -> np.ndarray:
        """
        Convert the input image to RGB format if it isn't already.

        Args:
            image (np.ndarray): Input image, possibly grayscale or single/multi-channel.

        Returns:
            np.ndarray: Image in RGB format with shape (H, W, 3).
        """
        # 1. Grayscale image -> replicate channels to RGB
        if image.ndim == 2:
            image = np.stack([image] * 3, axis=-1)

        # 2. Single-channel image -> concatenate across channels
        if image.ndim == 3 and image.shape[-1] == 1:
            image = np.concatenate([image] * 3, axis=-1)

        # 3. Drop alpha channel if present
        if image.ndim == 3 and image.shape[-1] == 4:
            image = image[:, :, :3]

        return image

    @staticmethod
    def _to_uint8(image: np.ndarray) -> np.ndarray:
        """
        Normalize and convert the image to uint8 format for visualization.

        Args:
            image (np.ndarray): Input image as float or integer array.

        Returns:
            np.ndarray: Image array in uint8 format scaled to [0, 255].
        """
        # 1. Scale to 0-255 if in [0, 1] range
        if image.dtype != np.uint8:
            if image.max() <= 1.0:
                image = image * 255.0

            # 2. Clip to valid pixel range and convert
            image = np.clip(image, 0, 255).astype(np.uint8)

        return image
