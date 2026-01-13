# ====== Code Summary ======
# Implements a Grad-CAM explainer compatible with TorchXRayVision models.
# This module generates class activation heatmaps overlaid on grayscale medical images
# for model interpretability. It supports customizable color mapping, transparency,
# and hook-based gradient extraction from convolutional layers.

# ====== Standard Library Imports ======
from __future__ import annotations
import uuid
from typing import Callable, Literal

# ====== Third-Party Library Imports ======
import numpy as np
import torch
import torch.nn.functional as F

# ====== Internal Project Imports ======
from .base import XaiBase

TorchDevice = torch.device
TensorHook = Callable[[torch.nn.Module, tuple[torch.Tensor, ...], torch.Tensor], None]
BackwardHook = Callable[
    [torch.nn.Module, tuple[torch.Tensor, ...], tuple[torch.Tensor, ...]],
    None,
]


class XaiGradCAM(XaiBase):
    """
    Grad-CAM explainer.

    - Computes a Grad-CAM heatmap in [0,1] with shape [H,W].
    - Returns an explained image (overlay) as an RGB numpy array [H,W,3] in [0,1].
    """

    # ====== Static Utility Methods ======

    @staticmethod
    def _normalize_01(arr: np.ndarray) -> np.ndarray:
        # 1. Normalize array to range [0, 1]
        arr = arr.astype(np.float32)
        arr_min: float = float(arr.min())
        arr_max: float = float(arr.max())
        return (arr - arr_min) / (arr_max - arr_min + 1e-8)

    @staticmethod
    def _tensor_to_grayscale_01(x: torch.Tensor) -> np.ndarray:
        # 1. Validate input shape
        if x.ndim != 4 or x.shape[0] != 1:
            raise ValueError(f"Expected x shape [1,C,H,W], got {tuple(x.shape)}")

        # 2. Convert to NumPy and average channels to grayscale
        x_np = x.detach().cpu().float().numpy()
        img = x_np[0].mean(axis=0)

        # 3. Normalize to [0,1]
        return XaiGradCAM._normalize_01(img)

    @staticmethod
    def _jet_colormap(heatmap_01: np.ndarray) -> np.ndarray:
        # 1. Apply lightweight Jet colormap
        h = np.clip(heatmap_01.astype(np.float32), 0.0, 1.0)
        r = np.clip(1.5 - np.abs(4.0 * h - 3.0), 0.0, 1.0)
        g = np.clip(1.5 - np.abs(4.0 * h - 2.0), 0.0, 1.0)
        b = np.clip(1.5 - np.abs(4.0 * h - 1.0), 0.0, 1.0)
        return np.stack([r, g, b], axis=-1)

    @staticmethod
    def _overlay_heatmap(
            base_gray_01: np.ndarray,
            heatmap_01: np.ndarray,
            *,
            alpha: float = 0.45,
            threshold: float | None = None,
            colormap: Literal["jet"] = "jet",
    ) -> np.ndarray:
        # 1. Validate shape
        if base_gray_01.shape != heatmap_01.shape:
            raise ValueError(
                f"base and heatmap must have same shape, got {base_gray_01.shape} vs {heatmap_01.shape}"
            )

        # 2. Normalize base and heatmap
        base = np.clip(base_gray_01.astype(np.float32), 0.0, 1.0)
        hm = np.clip(heatmap_01.astype(np.float32), 0.0, 1.0)

        # 3. Apply thresholding if provided
        if threshold is not None:
            hm = np.where(hm >= float(threshold), hm, 0.0)

        # 4. Convert grayscale base to RGB
        base_rgb = np.stack([base, base, base], axis=-1)

        # 5. Apply colormap
        if colormap == "jet":
            hm_rgb = XaiGradCAM._jet_colormap(hm)
        else:
            raise ValueError(f"Unsupported colormap: {colormap}")

        # 6. Blend base with heatmap
        out = (1.0 - alpha) * base_rgb + alpha * hm_rgb
        return np.clip(out, 0.0, 1.0)

    # ====== Private Internal Methods ======

    def _find_last_conv(self) -> torch.nn.Conv2d:
        # 1. Search for last Conv2d layer in model
        last: torch.nn.Conv2d | None = None
        for module in self._model.modules():
            if isinstance(module, torch.nn.Conv2d):
                last = module

        if last is None:
            self.logger.error("Grad-CAM requires Conv2d layers (none found).")
            raise RuntimeError("Grad-CAM requires Conv2d layers (none found).")

        return last

    def _validate_target_label(self, target_label: str) -> int:
        # 1. Ensure model has .pathologies attribute
        if not hasattr(self._model, "pathologies"):
            raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

        # 2. Validate label
        pathologies: list[str] = list(self._model.pathologies)
        if target_label not in pathologies:
            raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

        # 3. Return class index
        return pathologies.index(target_label)

    def _compute_gradcam(
            self,
            x: torch.Tensor,
            class_idx: int,
            target_layer: torch.nn.Module,
            run_id: str,
    ) -> np.ndarray:
        # 1. Initialize activation and gradient holders
        activations: torch.Tensor | None = None
        gradients: torch.Tensor | None = None

        # 2. Define forward hook
        def fwd_hook(_module, _inputs, output) -> None:
            nonlocal activations
            activations = output

        # 3. Define backward hook
        def bwd_hook(_module, _grad_in, grad_out) -> None:
            nonlocal gradients
            gradients = grad_out[0]

        # 4. Register hooks
        self.logger.debug(f"PROGRESS registering hooks (run_id={run_id})")
        h1 = target_layer.register_forward_hook(fwd_hook)
        h2 = target_layer.register_full_backward_hook(bwd_hook)

        try:
            # 5. Forward pass
            out: torch.Tensor = self._model(x)

            # 6. Backward pass
            self._model.zero_grad(set_to_none=True)
            score: torch.Tensor = out[0, class_idx]
            score.backward()

            # 7. Validate hooks captured tensors
            if activations is None or gradients is None:
                raise RuntimeError("Grad-CAM hooks did not capture tensors.")

            # 8. Compute weighted activations
            weights = gradients.mean(dim=(2, 3), keepdim=True)
            cam = (weights * activations).sum(dim=1)
            cam = F.relu(cam)

            # 9. Resize CAM to input size
            cam = F.interpolate(
                cam.unsqueeze(1),
                size=(x.shape[2], x.shape[3]),
                mode="bilinear",
                align_corners=False,
            )

            # 10. Convert to NumPy and normalize
            cam_np = cam.squeeze().detach().cpu().numpy()
            return self._normalize_01(cam_np)

        finally:
            # 11. Remove hooks
            h1.remove()
            h2.remove()
            self.logger.debug(f"PROGRESS removed hooks (run_id={run_id})")

    # ====== Public API ======

    def explain(
            self,
            x: torch.Tensor,
            target_label: str,
            base_image: np.ndarray,
            *,
            alpha: float = 0.45,
            threshold: float | None = None,
            colormap: Literal["jet"] = "jet",
            return_heatmap: bool = False,
            **kwargs,
    ) -> np.ndarray:
        """
        Generate Grad-CAM heatmap or overlay.

        Args:
            x (torch.Tensor): Input tensor [1,C,H,W].
            target_label (str): Target pathology label.
            base_image (np.ndarray): Grayscale base image for overlay [H,W].
            alpha (float): Overlay transparency.
            threshold (float | None): Optional threshold to mask heatmap.
            colormap (Literal["jet"]): Colormap to use.
            return_heatmap (bool): Whether to return raw heatmap instead of overlay.

        Returns:
            np.ndarray: [H,W] heatmap or [H,W,3] overlay, both in [0,1].
        """
        # 1. Generate run ID for logging
        run_id: str = uuid.uuid4().hex[:12]
        self.logger.info(
            f"START generating Grad-CAM (run_id={run_id}, target_label='{target_label}', "
            f"input_shape={tuple(x.shape)})"
        )

        try:
            # 2. Validate target label
            class_idx = self._validate_target_label(target_label)

            # 3. Identify last conv layer
            target_layer = self._find_last_conv()

            # 4. Compute heatmap
            heatmap = self._compute_gradcam(x, class_idx, target_layer, run_id)

            # 5. Return raw heatmap if requested
            if return_heatmap:
                self.logger.info(
                    f"END generating Grad-CAM (run_id={run_id}, heatmap_shape={heatmap.shape})"
                )
                return heatmap

            # 6. Prepare base grayscale image
            if base_image is None:
                base_gray = self._tensor_to_grayscale_01(x)
            else:
                base_gray = base_image.astype(np.float32)
                if base_gray.ndim != 2:
                    raise ValueError(f"base_image must be [H,W], got shape {base_gray.shape}")
                if base_gray.max() > 1.0:
                    base_gray = base_gray / 255.0
                base_gray = np.clip(base_gray, 0.0, 1.0)

            # 7. Overlay heatmap
            overlay = self._overlay_heatmap(
                base_gray,
                heatmap,
                alpha=alpha,
                threshold=threshold,
                colormap=colormap,
            )

            # 8. Log and return overlay
            self.logger.info(
                f"END generating Grad-CAM overlay (run_id={run_id}, overlay_shape={overlay.shape})"
            )
            return overlay

        except Exception as exc:
            # 9. Log exception and re-raise
            self.logger.error(
                f"END generating Grad-CAM with error (run_id={run_id}, "
                f"exc_type='{type(exc).__name__}', message='{exc}')"
            )
            raise
