# ====== Code Summary ======
# Defines an abstract base class for explainable AI (XAI) methods.
# Provides a common interface for generating visual explanations from a model,
# and integrates structured logging functionality.

from __future__ import annotations

# ====== Standard Library Imports ======
from abc import ABC, abstractmethod

# ====== Third-Party Library Imports ======
import numpy as np
import tensorflow as tf
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from .overlay_config import OverlayConfig


class XaiBase(LoggerClass, ABC):
    """
    Abstract base class for all XAI explainers.

    Inherits structured logging from LoggerClass and enforces implementation
    of the `explain` method for generating visualization overlays.

    Attributes:
        _model (tf.keras.Model): The model being explained.
    """

    def __init__(self, model: tf.keras.Model) -> None:
        """
        Initializes the explainer with a given model and sets up the logger.

        Args:
            model (tf.keras.Model): The model to be used for explanation.
        """
        LoggerClass.__init__(self)
        self._model: tf.keras.Model = model
        self.logger.debug("Initialized %s", self.__class__.__name__)

    @abstractmethod
    def explain(
            self,
            x: np.ndarray,
            class_index: int,
            base_image: np.ndarray,
            overlay_cfg: OverlayConfig,
    ) -> np.ndarray:
        """
        Abstract method to generate a visual explanation for the given input.

        Args:
            x (np.ndarray): Input sample or batch for explanation.
            class_index (int): Index of the target class to explain.
            base_image (np.ndarray): Base image used for overlay.
            overlay_cfg (OverlayConfig): Configuration for overlay rendering.

        Returns:
            np.ndarray: Display-ready RGB image with dtype uint8.
        """
        ...
