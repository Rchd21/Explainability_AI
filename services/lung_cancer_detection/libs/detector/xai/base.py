# ====== Code Summary ======
# This module defines an abstract base class `XaiBase` for explainability (XAI) methods.
# It wraps a PyTorch model and provides a logging-enabled interface for subclasses
# to implement specific explainability algorithms.

# ====== Standard Library Imports ======
from abc import ABC, abstractmethod

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass
import numpy as np
import torch


class XaiBase(ABC, LoggerClass):
    """
    Abstract base class for XAI (explainable AI) methods.

    Wraps a PyTorch model and enforces implementation of an `explain` method
    for generating explainability outputs.

    Inherits from:
        - ABC: To enforce abstract method definitions.
        - LoggerClass: For consistent logging across subclasses.
    """

    def __init__(self, model: torch.nn.Module) -> None:
        """
        Initialize the base class with the given PyTorch model.

        Args:
            model (torch.nn.Module): The model to explain.
        """
        LoggerClass.__init__(self)
        self._model: torch.nn.Module = model
        self.logger.info(f"Initialized with model: {model.__class__.__name__}")

    @abstractmethod
    def explain(
            self,
            x: torch.Tensor,
            target_label: str,
            base_image: np.ndarray,
            **kwargs,
    ) -> np.ndarray:
        """
        Generate an explainability visualization for a given model input and target label.

        This method computes an explanation based on the model's behavior using the
        preprocessed input tensor `x`, and optionally renders the explanation on a
        human-interpretable base image.

        Args:
            x (torch.Tensor):
                Model input tensor used for explanation.
                Shape: [1, C, H, W].
                This tensor is assumed to be fully preprocessed and normalized as expected
                by the underlying model.

            target_label (str):
                Name of the target class to explain.
                Must correspond to an entry in the model's `pathologies` attribute.

            base_image (np.ndarray):
                Image used only for visualization purposes.
                Expected shape: [H, W] (grayscale).
                Expected value range: [0, 1] or [0, 255].
                If provided, the explanation will be rendered on top of this image.
                If None, the explainer may fall back to a visualization derived from `x`.

            **kwargs:
                Additional explainer-specific parameters
                (e.g. number of samples for LIME, thresholds for Grad-CAM, colormap options).

        Returns:
            np.ndarray:
                Explanation visualization as a NumPy array.
                Typical shapes:
                  - [H, W]        : raw explanation map (e.g. heatmap)
                  - [H, W, 3]     : RGB overlay visualization
                Value range is implementation-dependent but typically normalized to [0, 1].
        """
        ...
