from __future__ import annotations

import uuid
from typing import Callable, Literal

import numpy as np
import torch
import torch.nn.functional as F

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
        arr = arr.astype(np.float32)
        arr_min: float = float(arr.min())
        arr_max: float = float(arr.max())
        return (arr - arr_min) / (arr_max - arr_min + 1e-8)

    @staticmethod
    def _tensor_to_grayscale_01(x: torch.Tensor) -> np.ndarray:
        """
        Convert input tensor [1,C,H,W] to grayscale image [H,W] in [0,1].
        Uses min-max normalization on the tensor content.
        """
        if x.ndim != 4 or x.shape[0] != 1:
            raise ValueError(f"Expected x shape [1,C,H,W], got {tuple(x.shape)}")

        x_np = x.detach().cpu().float().numpy()  # [1,C,H,W]
        # If C>1, average channels; if C==1, squeeze it.
        img = x_np[0].mean(axis=0)  # [H,W]
        img = XaiGradCAM._normalize_01(img)
        return img

    @staticmethod
    def _jet_colormap(heatmap_01: np.ndarray) -> np.ndarray:
        """
        Lightweight "jet-like" colormap without matplotlib.
        Input: [H,W] in [0,1]
        Output: [H,W,3] in [0,1]
        """
        h = np.clip(heatmap_01.astype(np.float32), 0.0, 1.0)

        # Simple approximation of jet:
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
        """
        Create an overlay image (RGB) from a grayscale base + heatmap.

        base_gray_01: [H,W] in [0,1]
        heatmap_01:   [H,W] in [0,1]
        returns:      [H,W,3] in [0,1]
        """
        if base_gray_01.shape != heatmap_01.shape:
            raise ValueError(
                f"base and heatmap must have same shape, got {base_gray_01.shape} vs {heatmap_01.shape}"
            )

        base = np.clip(base_gray_01.astype(np.float32), 0.0, 1.0)
        hm = np.clip(heatmap_01.astype(np.float32), 0.0, 1.0)

        if threshold is not None:
            # Keep only the "important" regions
            hm = np.where(hm >= float(threshold), hm, 0.0)

        base_rgb = np.stack([base, base, base], axis=-1)  # [H,W,3]

        if colormap == "jet":
            hm_rgb = XaiGradCAM._jet_colormap(hm)
        else:
            raise ValueError(f"Unsupported colormap: {colormap}")

        a = float(alpha)
        out = (1.0 - a) * base_rgb + a * hm_rgb
        return np.clip(out, 0.0, 1.0)

    # ====== Private Internal Methods ======

    def _find_last_conv(self) -> torch.nn.Conv2d:
        last: torch.nn.Conv2d | None = None
        for module in self._model.modules():
            if isinstance(module, torch.nn.Conv2d):
                last = module

        if last is None:
            self.logger.error("Grad-CAM requires Conv2d layers (none found).")
            raise RuntimeError("Grad-CAM requires Conv2d layers (none found).")

        return last

    def _validate_target_label(self, target_label: str) -> int:
        if not hasattr(self._model, "pathologies"):
            raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

        pathologies: list[str] = list(self._model.pathologies)
        if target_label not in pathologies:
            raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

        return pathologies.index(target_label)

    def _compute_gradcam(
            self,
            x: torch.Tensor,
            class_idx: int,
            target_layer: torch.nn.Module,
            run_id: str,
    ) -> np.ndarray:
        activations: None | torch.Tensor = None
        gradients: None | torch.Tensor = None

        def fwd_hook(_module, _inputs, output) -> None:
            nonlocal activations
            activations = output

        def bwd_hook(_module, _grad_in, grad_out) -> None:
            nonlocal gradients
            gradients = grad_out[0]

        self.logger.debug(
            f"PROGRESS registering hooks (run_id={run_id}, layer='{target_layer.__class__.__name__}')"
        )

        h1 = target_layer.register_forward_hook(fwd_hook)
        h2 = target_layer.register_full_backward_hook(bwd_hook)

        try:
            out: torch.Tensor = self._model(x)

            self._model.zero_grad(set_to_none=True)
            score: torch.Tensor = out[0, class_idx]
            score.backward()

            if activations is None or gradients is None:
                raise RuntimeError("Grad-CAM hooks did not capture tensors.")

            weights: torch.Tensor = gradients.mean(dim=(2, 3), keepdim=True)
            cam: torch.Tensor = (weights * activations).sum(dim=1)
            cam = F.relu(cam)

            cam = F.interpolate(
                cam.unsqueeze(1),
                size=(int(x.shape[2]), int(x.shape[3])),
                mode="bilinear",
                align_corners=False,
            )

            cam_np: np.ndarray = cam.squeeze().detach().cpu().numpy()
            cam_np = self._normalize_01(cam_np)

            self.logger.debug(
                f"PROGRESS computed heatmap (run_id={run_id}, shape={cam_np.shape})"
            )
            return cam_np

        finally:
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
        Returns the explained image overlay by default: [H,W,3] in [0,1].

        If return_heatmap=True, returns the raw heatmap [H,W] in [0,1].

        base_image:
          - optional grayscale base image [H,W] (float in [0,1] or uint8 in [0,255])
          - if not provided, base image is derived from x by min-max normalization.
        """
        run_id: str = uuid.uuid4().hex[:12]
        self.logger.info(
            f"START generating Grad-CAM (run_id={run_id}, target_label='{target_label}', "
            f"input_shape={tuple(x.shape)})"
        )

        try:
            class_idx: int = self._validate_target_label(target_label)
            target_layer: torch.nn.Module = self._find_last_conv()

            heatmap: np.ndarray = self._compute_gradcam(
                x=x,
                class_idx=class_idx,
                target_layer=target_layer,
                run_id=run_id,
            )

            if return_heatmap:
                self.logger.info(
                    f"END generating Grad-CAM (run_id={run_id}, heatmap_shape={heatmap.shape})"
                )
                return heatmap

            if base_image is None:
                base_gray = self._tensor_to_grayscale_01(x)
            else:
                base_gray = base_image.astype(np.float32)
                if base_gray.ndim != 2:
                    raise ValueError(f"base_image must be [H,W], got shape {base_gray.shape}")
                if base_gray.max() > 1.0:
                    base_gray = base_gray / 255.0
                base_gray = np.clip(base_gray, 0.0, 1.0)

            overlay: np.ndarray = self._overlay_heatmap(
                base_gray,
                heatmap,
                alpha=alpha,
                threshold=threshold,
                colormap=colormap,
            )

            self.logger.info(
                f"END generating Grad-CAM overlay (run_id={run_id}, overlay_shape={overlay.shape})"
            )
            return overlay

        except Exception as exc:
            self.logger.error(
                f"END generating Grad-CAM with error (run_id={run_id}, "
                f"exc_type='{type(exc).__name__}', message='{exc}')"
            )
            raise
