# ====== Code Summary ======
# This module implements `XaiLime`, an explainability method based on LIME for interpreting
# chest X-ray predictions from TorchXRayVision-style models.
# - LIME perturbations are generated from an RGB view derived from the model input tensor `x`.
# - Predictions are computed by mapping perturbed RGB images back to the model preprocessing pipeline.
# - The final visualization is rendered on a clean base image (base_image) when provided.

from __future__ import annotations

import uuid
from typing import Callable

import numpy as np
import torch
import torchxrayvision as xrv
from lime import lime_image
from skimage.segmentation import mark_boundaries

from .base import XaiBase
from ..helpers import DetectorHelpers

TorchDevice = torch.device


class XaiLime(XaiBase):
    """Generate LIME explanations for TorchXRayVision-style chest X-ray classifiers.

    This explainer:
      1) Converts the input tensor (single-channel) to an RGB image in [0, 1] for LIME.
      2) Lets LIME perturb the image.
      3) Maps LIME perturbations back to the model's expected grayscale preprocessing pipeline.
      4) Produces an RGB overlay with segment boundaries.

    Display note:
      - If `base_image` is provided (recommended), boundaries are drawn on it for a clinically readable overlay.
      - Otherwise, the overlay is drawn on the min-max RGB view derived from `x` (debug-friendly fallback).
    """

    # ====== Static Utility Methods ======

    @staticmethod
    def _x_to_rgb01(x: torch.Tensor) -> np.ndarray:
        """
        Convert a 1x1xHxW tensor into an RGB numpy image in [0, 1].

        Args:
            x (torch.Tensor): Input tensor of shape [1, 1, H, W].

        Returns:
            np.ndarray: RGB image of shape [H, W, 3] with values in [0, 1].
        """
        img: np.ndarray = x[0, 0].detach().cpu().numpy().astype(np.float32)
        img_min: float = float(img.min())
        img_max: float = float(img.max())
        img01: np.ndarray = (img - img_min) / (img_max - img_min + 1e-8)
        return np.stack([img01, img01, img01], axis=-1)

    @staticmethod
    def _gray01_to_rgb01(gray: np.ndarray) -> np.ndarray:
        """
        Convert a grayscale [H,W] image in [0,1] (or [0,255]) to RGB [H,W,3] in [0,1].
        """
        if gray.ndim != 2:
            raise ValueError(f"Expected grayscale image [H,W], got shape {gray.shape}")

        g = gray.astype(np.float32)
        if g.max() > 1.0:
            g = g / 255.0
        g = np.clip(g, 0.0, 1.0)
        return np.stack([g, g, g], axis=-1)

    @staticmethod
    def _preprocess_rgb_to_model_input(
            image_rgb: np.ndarray,
            cropper: Callable[[np.ndarray], np.ndarray],
            resizer: Callable[[np.ndarray], np.ndarray],
    ) -> np.ndarray:
        """
        Convert an RGB [0,1] image into a TorchXRayVision-normalized 1x224x224 grayscale array.

        Args:
            image_rgb (np.ndarray): RGB image of shape [H, W, 3] with values in [0, 1].
            cropper (Callable): Instance of xrv.datasets.XRayCenterCrop().
            resizer (Callable): Instance of xrv.datasets.XRayResizer(224).

        Returns:
            np.ndarray: Grayscale image of shape [1, 224, 224] (channel-first).
        """
        # Convert to grayscale [0,1]
        gray01: np.ndarray = image_rgb.mean(axis=2).astype(np.float32)

        # Normalize for XRV (expects float image, maxval=1.0 here)
        gray: np.ndarray = xrv.datasets.normalize(gray01, 1.0)

        # Add channel dim, then crop+resize
        gray = gray[np.newaxis, :, :]
        gray = cropper(gray)
        gray = resizer(gray)

        return gray

    # ====== Private Methods ======

    def _predict_proba_for_lime(
            self,
            images_rgb: np.ndarray,
            class_idx: int,
            device: TorchDevice,
    ) -> np.ndarray:
        """
        Predict 2-class probabilities for LIME: [not_target, target].

        Args:
            images_rgb (np.ndarray): Batch of RGB images [B, H, W, 3] in [0, 1].
            class_idx (int): Index of the target class.
            device (torch.device): Device for inference.

        Returns:
            np.ndarray: Probability array [B, 2].
        """
        cropper: Callable = xrv.datasets.XRayCenterCrop()
        resizer: Callable = xrv.datasets.XRayResizer(224)

        inputs: list[torch.Tensor] = []
        for im in images_rgb:
            gray: np.ndarray = self._preprocess_rgb_to_model_input(im, cropper, resizer)
            xt: torch.Tensor = torch.from_numpy(gray).unsqueeze(0).float().to(device)
            inputs.append(xt)

        xb: torch.Tensor = torch.cat(inputs, dim=0)

        with torch.no_grad():
            out: torch.Tensor = self._model(xb)
            score_t: torch.Tensor = out[:, class_idx]

        # TorchXRayVision DenseNet outputs are typically sigmoid probabilities per class.
        score: np.ndarray = score_t.detach().cpu().numpy().astype(np.float32)
        score = np.clip(score, 0.0, 1.0)
        return np.stack([1.0 - score, score], axis=1)

    # ====== Public API ======

    def explain(
            self,
            x: torch.Tensor,
            target_label: str,
            base_image: np.ndarray,
            num_samples: int = 1000,
            num_features: int = 10,
    ) -> np.ndarray:
        """
        Generate a LIME explanation overlay for a target label.

        Args:
            x (torch.Tensor): Input tensor [1, 1, H, W] (model input).
            target_label (str): Label name from `self._model.pathologies`.
            num_samples (int): Number of LIME perturbation samples.
            num_features (int): Superpixels to keep in the final explanation.
            base_image (np.ndarray | None):
                Optional grayscale [H,W] (recommended) aligned with x for clean display.
                If provided, boundaries are rendered on this image (clinically readable).

        Returns:
            np.ndarray: RGB image [H, W, 3] in [0,1] with boundary-marked explanation overlay.
        """
        run_id: str = uuid.uuid4().hex[:12]
        self.logger.info(
            f"START generating LIME explanation (run_id={run_id}, target_label='{target_label}', "
            f"num_samples={num_samples}, num_features={num_features})"
        )

        try:
            # 1) Validate model and label
            if not hasattr(self._model, "pathologies"):
                raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

            pathologies: list[str] = list(self._model.pathologies)
            if target_label not in pathologies:
                raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

            class_idx: int = pathologies.index(target_label)
            device: TorchDevice = DetectorHelpers.get_model_device(self._model)

            self.logger.debug(
                f"PROGRESS resolved target class index (run_id={run_id}, class_idx={class_idx}, device='{device}')"
            )

            # 2) Image for LIME perturbations (keep behavior consistent: derive from x)
            img_rgb_for_lime: np.ndarray = self._x_to_rgb01(x)

            # 3) Image for DISPLAY (clean base when provided)
            if base_image is None:
                img_rgb_for_display: np.ndarray = img_rgb_for_lime
            else:
                img_rgb_for_display = self._gray01_to_rgb01(base_image)

                # Optional safety: ensure same spatial shape
                if img_rgb_for_display.shape[:2] != img_rgb_for_lime.shape[:2]:
                    raise ValueError(
                        f"base_image shape {img_rgb_for_display.shape[:2]} does not match x shape {img_rgb_for_lime.shape[:2]}"
                    )

            # 4) LIME prediction wrapper
            predict_fn: Callable[[np.ndarray], np.ndarray] = (
                lambda images_rgb: self._predict_proba_for_lime(
                    images_rgb, class_idx=class_idx, device=device
                )
            )

            # 5) Run LIME
            explainer: lime_image.LimeImageExplainer = lime_image.LimeImageExplainer()
            self.logger.debug(f"PROGRESS running LIME explainer (run_id={run_id})")

            explanation = explainer.explain_instance(
                img_rgb_for_lime,
                classifier_fn=predict_fn,
                labels=(1,),
                hide_color=0,
                num_samples=num_samples,
            )

            # 6) Extract mask, render boundaries on DISPLAY image
            _temp, mask = explanation.get_image_and_mask(
                label=1,
                positive_only=True,
                num_features=num_features,
                hide_rest=False,
            )

            overlay: np.ndarray = mark_boundaries(img_rgb_for_display, mask)
            result: np.ndarray = np.clip(overlay.astype(np.float32), 0.0, 1.0)

            self.logger.info(
                f"END generating LIME explanation (run_id={run_id}, target_label='{target_label}', "
                f"result_shape={result.shape})"
            )
            return result

        except Exception as exc:
            self.logger.error(
                f"END generating LIME explanation with error (run_id={run_id}, "
                f"exc_type='{type(exc).__name__}', message='{exc}')"
            )
            raise
