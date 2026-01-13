# ====== Code Summary ======
# Abstract base class for PyTorch-based explainable AI (XAI) methods.
# Defines a unified interface (`explain`) for generating model visualizations,
# supports logging, and wraps a PyTorch model instance for use by XAI implementations.

from __future__ import annotations

# ====== Standard Library Imports ======
from abc import ABC, abstractmethod

# ====== Third-Party Library Imports ======
import numpy as np
import torch
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from .overlay_config import OverlayConfig


class XaiBase(ABC, LoggerClass):
    """
    Abstract base class for XAI (Explainable AI) methods.

    Wraps a PyTorch model and provides structured logging.
    Requires implementing the `explain` method for generating visual explanations.

    Attributes:
        _model (torch.nn.Module): The PyTorch model to be explained.
    """

    def __init__(self, model: torch.nn.Module) -> None:
        """
        Initialize the XAI base class with a given model and logger.

        Args:
            model (torch.nn.Module): The model to be explained.
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
            overlay_cfg: OverlayConfig,
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

            overlay_cfg (OverlayConfig):
                Configuration specifying alpha and clipping settings for visual overlays.

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
