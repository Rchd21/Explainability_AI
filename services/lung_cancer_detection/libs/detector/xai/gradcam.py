from __future__ import annotations

# ====== Standard Library Imports ======
import uuid
from collections.abc import Callable

# ====== Third-Party Imports ======
import numpy as np
import torch
import torch.nn.functional as F

# ====== Internal Project Imports ======
from .base import XaiBase
from .helpers import XaiHelpers
from .overlay_config import OverlayConfig

# ====== Type Hints ======
TorchDevice = torch.device
ForwardHook = Callable[[torch.nn.Module, tuple[torch.Tensor, ...], torch.Tensor], None]
BackwardHook = Callable[
    [torch.nn.Module, tuple[torch.Tensor, ...], tuple[torch.Tensor, ...]],
    None,
]


class XaiGradCAM(XaiBase):
    """Grad-CAM explainer.

    Important behavior:
      - Applies ReLU to the CAM: shows regions that support the target class only.
      - No negative evidence is shown.
      - Heatmap is normalized to [0, 1] (relative intensity).

    Output:
      - If `return_heatmap=True`: returns heatmap float32 `[H, W]` in `[0, 1]`.
      - Else: returns RGB uint8 overlay image `[H, W, 3]`.

    Notes:
        This implementation selects the *last* Conv2d layer in the model by default.
    """

    def _find_last_conv(self) -> torch.nn.Conv2d:
        """Find the last Conv2d module in the model.

        Returns:
            The last `torch.nn.Conv2d` module discovered via `model.modules()`.

        Raises:
            RuntimeError: If no Conv2d layers are found.
        """
        last: torch.nn.Conv2d | None = None
        for module in self._model.modules():
            if isinstance(module, torch.nn.Conv2d):
                last = module

        if last is None:
            self.logger.error("Grad-CAM requires Conv2d layers (none found).")
            raise RuntimeError("Grad-CAM requires Conv2d layers (none found).")

        return last

    def _validate_target_label(self, target_label: str) -> int:
        """Validate the target label against `model.pathologies` and return its class index.

        Args:
            target_label: Pathology label to explain.

        Returns:
            The index of the target label in `model.pathologies`.

        Raises:
            ValueError: If the model has no `.pathologies` or the label is unknown.
        """
        if not hasattr(self._model, "pathologies"):
            raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

        pathologies: list[str] = list(self._model.pathologies)
        if target_label not in pathologies:
            raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

        return int(pathologies.index(target_label))

    def _compute_gradcam(
            self,
            x: torch.Tensor,
            *,
            class_idx: int,
            target_layer: torch.nn.Module,
            run_id: str,
    ) -> np.ndarray:
        """Compute a Grad-CAM heatmap for a single input sample.

        Args:
            x: Input tensor. Expected shape `[1, C, H, W]`.
            class_idx: Target class index in model output.
            target_layer: Layer on which to compute Grad-CAM (typically Conv2d).
            run_id: Correlation id for logging.

        Returns:
            Heatmap float32 `[H, W]` normalized to `[0, 1]`.

        Raises:
            ValueError: If `x` does not have a batch size of 1.
            RuntimeError: If hooks fail to capture activations/gradients.
        """
        if x.ndim != 4 or int(x.shape[0]) != 1:
            raise ValueError(f"Expected x shape [1,C,H,W], got {tuple(x.shape)}")

        activations: None | torch.Tensor = None
        gradients: None | torch.Tensor = None

        def fwd_hook(_module: torch.nn.Module, _inputs: tuple[torch.Tensor, ...], output: torch.Tensor) -> None:
            nonlocal activations
            activations = output

        def bwd_hook(
                _module: torch.nn.Module,
                _grad_in: tuple[torch.Tensor, ...],
                grad_out: tuple[torch.Tensor, ...],
        ) -> None:
            nonlocal gradients
            gradients = grad_out[0]

        self.logger.debug(f"PROGRESS registering hooks (run_id={run_id}, layer={type(target_layer).__name__})")
        h_fwd = target_layer.register_forward_hook(fwd_hook)
        h_bwd = target_layer.register_full_backward_hook(bwd_hook)

        try:
            self._model.eval()
            out: torch.Tensor = self._model(x)

            if out.ndim != 2 or int(out.shape[0]) != 1:
                raise RuntimeError(f"Unexpected model output shape for Grad-CAM: {tuple(out.shape)}")

            if class_idx < 0 or class_idx >= int(out.shape[1]):
                raise RuntimeError(
                    f"class_idx out of bounds (class_idx={class_idx}, num_classes={int(out.shape[1])})"
                )

            self._model.zero_grad(set_to_none=True)
            score: torch.Tensor = out[0, int(class_idx)]
            score.backward()

            if activations is None or gradients is None:
                raise RuntimeError("Grad-CAM hooks did not capture tensors.")

            # Global-average-pool gradients over spatial dims -> weights per channel
            weights: torch.Tensor = gradients.mean(dim=(2, 3), keepdim=True)  # [1,C,1,1]
            cam: torch.Tensor = (weights * activations).sum(dim=1)  # [1,H',W']
            cam = F.relu(cam)

            cam = F.interpolate(
                cam.unsqueeze(1),  # [1,1,H',W']
                size=(int(x.shape[2]), int(x.shape[3])),
                mode="bilinear",
                align_corners=False,
            )

            cam_np = cam.squeeze().detach().cpu().numpy().astype(np.float32)
            return XaiHelpers.normalize_01(cam_np).astype(np.float32)

        finally:
            h_fwd.remove()
            h_bwd.remove()
            self.logger.debug(f"PROGRESS removed hooks (run_id={run_id})")

    def explain(
            self,
            x: torch.Tensor,
            target_label: str,
            base_image: np.ndarray,
            overlay_cfg: OverlayConfig,
            alpha: float | None = None,
            threshold: float | None = None,
            colormap: str = "jet",
            return_heatmap: bool = False,
            **kwargs: object,
    ) -> np.ndarray:
        """Explain a model prediction using Grad-CAM.

        Args:
            x: Input tensor. Expected shape `[1, C, H, W]`.
            target_label: Pathology label name present in `model.pathologies`.
            base_image: Optional base image for overlay (grayscale). If `None`, uses `x`.
            overlay_cfg: Overlay configuration (used for default alpha). If `None` is passed,
                a default `OverlayConfig()` is used.
            alpha: Overlay alpha. Defaults to `overlay_cfg.alpha_max` when not provided.
            threshold: Optional heatmap threshold before applying colormap.
            colormap: Matplotlib colormap name for unsigned heatmap overlay.
            return_heatmap: If True, return the raw heatmap instead of a rendered overlay.
            **kwargs: Unused extra arguments for interface compatibility.

        Returns:
            Heatmap float32 `[H, W]` if `return_heatmap=True`, otherwise RGB uint8 `[H, W, 3]`.

        Raises:
            ValueError: If the target label is invalid or `x` shape is unsupported.
            RuntimeError: If the model architecture/output is incompatible with Grad-CAM.
        """
        run_id = uuid.uuid4().hex[:12]

        if kwargs:
            self.logger.debug(
                f"PROGRESS Grad-CAM received unused kwargs (run_id={run_id}, keys={list(kwargs.keys())})"
            )

        self.logger.info(
            f"START Grad-CAM (run_id={run_id}, target_label='{target_label}', input_shape={tuple(x.shape)})"
        )

        result_u8: None | np.ndarray = None
        try:
            cfg = overlay_cfg if overlay_cfg is not None else OverlayConfig()

            effective_alpha = float(cfg.alpha_max) if alpha is None else float(alpha)

            class_idx = self._validate_target_label(target_label)
            target_layer = self._find_last_conv()

            heatmap = self._compute_gradcam(
                x,
                class_idx=class_idx,
                target_layer=target_layer,
                run_id=run_id,
            )

            if return_heatmap:
                return heatmap

            if base_image is None:
                base_gray = XaiHelpers.tensor_to_grayscale_01(x)
            else:
                base_gray = XaiHelpers.ensure_gray_01(base_image)

            overlay01 = XaiHelpers.overlay_heatmap_unsigned(
                base_gray,
                heatmap,
                alpha=effective_alpha,
                threshold=threshold,
                colormap=colormap,
            )

            result_u8 = XaiHelpers.to_uint8_rgb(overlay01)
            return result_u8

        except Exception as exc:  # noqa: BLE001
            self.logger.error(
                f"ERROR Grad-CAM failed (run_id={run_id}, exc_type={type(exc).__name__}, msg='{exc}')"
            )
            raise
        finally:
            if result_u8 is not None:
                self.logger.info(f"END Grad-CAM (run_id={run_id}, result_shape={result_u8.shape})")
            else:
                self.logger.info(f"END Grad-CAM (run_id={run_id}, result_shape=None)")
