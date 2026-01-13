# ====== Code Summary ======
# This module implements `XaiLime`, an explainability method based on LIME for interpreting
# chest X-ray predictions from TorchXRayVision-style models.
# - LIME perturbations are generated from an RGB view derived from the model input tensor `x`.
# - Predictions are computed by mapping perturbed RGB images back to the model preprocessing pipeline.
# - The final visualization is rendered on a clean base image (base_image) when provided.

from __future__ import annotations

# ====== Standard Library Imports ======
import uuid
from typing import Callable

# ====== Third-Party Library Imports ======
import numpy as np
import torch
import torchxrayvision as xrv
from lime import lime_image
from skimage.segmentation import mark_boundaries

# ====== Internal Project Imports ======
from .base import XaiBase
from ..helpers import DetectorHelpers

TorchDevice = torch.device


class XaiLime(XaiBase):
    """
    Generate LIME explanations for TorchXRayVision-style chest X-ray classifiers.

    This explainer:
      1) Converts the input tensor (single-channel) to an RGB image in [0, 1] for LIME.
      2) Lets LIME perturb the image.
      3) Maps LIME perturbations back to the model's expected grayscale preprocessing pipeline.
      4) Produces an RGB overlay with segment boundaries.
    """

    # ====== Static Utility Methods ======

    @staticmethod
    def _x_to_rgb01(x: torch.Tensor) -> np.ndarray:
        # 1. Extract and normalize the grayscale channel to RGB [0,1]
        img: np.ndarray = x[0, 0].detach().cpu().numpy().astype(np.float32)
        img_min: float = float(img.min())
        img_max: float = float(img.max())
        img01: np.ndarray = (img - img_min) / (img_max - img_min + 1e-8)
        return np.stack([img01, img01, img01], axis=-1)

    @staticmethod
    def _gray01_to_rgb01(gray: np.ndarray) -> np.ndarray:
        # 1. Validate input shape
        if gray.ndim != 2:
            raise ValueError(f"Expected grayscale image [H,W], got shape {gray.shape}")

        # 2. Normalize to [0,1] if needed and expand to RGB
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
        # 1. Convert RGB to grayscale and normalize
        gray01 = image_rgb.mean(axis=2).astype(np.float32)
        gray = xrv.datasets.normalize(gray01, 1.0)

        # 2. Add channel dimension and apply transforms
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
        # 1. Instantiate preprocessing tools
        cropper = xrv.datasets.XRayCenterCrop()
        resizer = xrv.datasets.XRayResizer(224)

        # 2. Preprocess each image in the batch
        inputs: list[torch.Tensor] = []
        for im in images_rgb:
            gray = self._preprocess_rgb_to_model_input(im, cropper, resizer)
            xt = torch.from_numpy(gray).unsqueeze(0).float().to(device)
            inputs.append(xt)

        # 3. Batch inference
        xb = torch.cat(inputs, dim=0)
        with torch.no_grad():
            out = self._model(xb)
            score_t = out[:, class_idx]

        # 4. Format as 2-class soft scores [not_target, target]
        score = score_t.detach().cpu().numpy().astype(np.float32)
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
            base_image (np.ndarray | None): Optional grayscale [H,W] for display overlay.

        Returns:
            np.ndarray: RGB image [H, W, 3] in [0,1] with boundary-marked explanation overlay.
        """
        # 1. Generate run ID for traceability
        run_id = uuid.uuid4().hex[:12]
        self.logger.info(
            f"START generating LIME explanation (run_id={run_id}, target_label='{target_label}', "
            f"num_samples={num_samples}, num_features={num_features})"
        )

        try:
            # 2. Validate model and target label
            if not hasattr(self._model, "pathologies"):
                raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

            pathologies = list(self._model.pathologies)
            if target_label not in pathologies:
                raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

            class_idx = pathologies.index(target_label)
            device = DetectorHelpers.get_model_device(self._model)

            self.logger.debug(
                f"PROGRESS resolved target class index (run_id={run_id}, class_idx={class_idx}, device='{device}')"
            )

            # 3. Generate RGB image from tensor for perturbation
            img_rgb_for_lime = self._x_to_rgb01(x)

            # 4. Prepare image for display
            if base_image is None:
                img_rgb_for_display = img_rgb_for_lime
            else:
                img_rgb_for_display = self._gray01_to_rgb01(base_image)
                if img_rgb_for_display.shape[:2] != img_rgb_for_lime.shape[:2]:
                    raise ValueError(
                        f"base_image shape {img_rgb_for_display.shape[:2]} does not match x shape {img_rgb_for_lime.shape[:2]}"
                    )

            # 5. Wrap model prediction for LIME
            predict_fn = lambda imgs: self._predict_proba_for_lime(
                imgs, class_idx=class_idx, device=device
            )

            # 6. Run LIME explainer
            explainer = lime_image.LimeImageExplainer()
            self.logger.debug(f"PROGRESS running LIME explainer (run_id={run_id})")

            explanation = explainer.explain_instance(
                img_rgb_for_lime,
                classifier_fn=predict_fn,
                labels=(1,),
                hide_color=0,
                num_samples=num_samples,
            )

            # 7. Extract mask and render overlay
            _temp, mask = explanation.get_image_and_mask(
                label=1,
                positive_only=True,
                num_features=num_features,
                hide_rest=False,
            )

            overlay = mark_boundaries(img_rgb_for_display, mask)
            result = np.clip(overlay.astype(np.float32), 0.0, 1.0)

            # 8. Return result
            self.logger.info(
                f"END generating LIME explanation (run_id={run_id}, target_label='{target_label}', result_shape={result.shape})"
            )
            return result

        except Exception as exc:
            # 9. Log and raise exception
            self.logger.error(
                f"END generating LIME explanation with error (run_id={run_id}, "
                f"exc_type='{type(exc).__name__}', message='{exc}')"
            )
            raise
