from __future__ import annotations

import uuid
from typing import Callable, Optional

import numpy as np
import torch
import torchxrayvision as xrv
from lime import lime_image
from scipy.ndimage import gaussian_filter
from skimage.segmentation import slic

from .base import XaiBase
from .helpers import XaiHelpers
from .overlay_config import OverlayConfig
from ..helpers import DetectorHelpers

TorchDevice = torch.device


class XaiLime(XaiBase):
    """
    Faster + nicer LIME visualization for TorchXRayVision models.

    - No config dataclass: defaults are stored as init params.
    - Signed overlay: red positive / blue negative, alpha based on magnitude.
    """

    def __init__(
            self,
            model: torch.nn.Module,
            *,
            # LIME speed/quality knobs
            num_samples: int = 900,
            slic_n_segments: int = 350,
            slic_compactness: float = 10.0,
            slic_sigma: float = 0.8,
            # Rendering knobs
            heat_blur_sigma: float = 1.2,  # visual smoothing
    ) -> None:
        super().__init__(model)

        self._num_samples = int(num_samples)
        self._slic_n_segments = int(slic_n_segments)
        self._slic_compactness = float(slic_compactness)
        self._slic_sigma = float(slic_sigma)
        self._heat_blur_sigma = float(heat_blur_sigma)

        # Reuse these across calls (speed win)
        self._cropper = xrv.datasets.XRayCenterCrop()
        self._resizer = xrv.datasets.XRayResizer(224)
        self._explainer = lime_image.LimeImageExplainer()

        # Prebuild segmentation fn (no need to recreate each call)
        self._segmentation_fn = self._make_slic_segmenter(
            n_segments=self._slic_n_segments,
            compactness=self._slic_compactness,
            sigma=self._slic_sigma,
        )

    # ----------------------------
    # Image helpers (TorchXRayVision specifics)
    # ----------------------------
    @staticmethod
    def _x_to_rgb01(x: torch.Tensor) -> np.ndarray:
        """
        Expect x [1,1,H,W]. Returns RGB float32 [H,W,3] in [0,1].
        """
        if x.ndim != 4 or x.shape[0] != 1 or x.shape[1] != 1:
            raise ValueError(f"Expected x shape [1,1,H,W], got {tuple(x.shape)}")

        img = x[0, 0].detach().cpu().numpy().astype(np.float32)
        img01 = XaiHelpers.normalize_01(img)
        return np.stack([img01, img01, img01], axis=-1).astype(np.float32)

    @staticmethod
    def _make_slic_segmenter(n_segments: int, compactness: float, sigma: float) -> Callable[[np.ndarray], np.ndarray]:
        n_segments = int(n_segments)

        def segmenter(img: np.ndarray) -> np.ndarray:
            return slic(
                img,
                n_segments=n_segments,
                compactness=float(compactness),
                sigma=float(sigma),
                start_label=0,
            )

        return segmenter

    # ----------------------------
    # Model preprocessing
    # ----------------------------
    def _preprocess_rgb_batch_to_model_input(self, images_rgb: np.ndarray) -> np.ndarray:
        """
        Convert a batch of RGB images [N,H,W,3] in [0,1] into model inputs [N,1,224,224] (numpy).
        """
        imgs = np.asarray(images_rgb, dtype=np.float32)
        if float(imgs.max()) > 1.0:
            imgs = imgs / 255.0
        imgs = np.clip(imgs, 0.0, 1.0)

        # RGB -> grayscale
        gray01 = imgs.mean(axis=3).astype(np.float32)  # [N,H,W]
        # Normalize like torchxrayvision expects
        gray = xrv.datasets.normalize(gray01, 1.0)  # [N,H,W]

        outs: list[np.ndarray] = []
        for i in range(gray.shape[0]):
            g = gray[i][np.newaxis, :, :]  # [1,H,W]
            g = self._cropper(g)
            g = self._resizer(g)  # [1,224,224]
            outs.append(g)

        return np.stack(outs, axis=0)  # [N,1,224,224]

    def _predict_proba_for_lime(self, images_rgb: np.ndarray, class_idx: int, device: TorchDevice) -> np.ndarray:
        xb_np = self._preprocess_rgb_batch_to_model_input(images_rgb)  # [N,1,224,224]
        xb = torch.from_numpy(xb_np).to(device=device, dtype=torch.float32)

        self._model.eval()
        with torch.inference_mode():
            out = self._model(xb)
            score_t = out[:, class_idx]
            # Convert logits to probs if needed
            if score_t.min().item() < 0.0 or score_t.max().item() > 1.0:
                score_t = torch.sigmoid(score_t)

        score = score_t.detach().cpu().numpy().astype(np.float32)
        score = np.clip(score, 0.0, 1.0)

        # LIME expects a "probability" vector per sample.
        # We'll return [P(class0), P(class1)] for a binary surrogate.
        return np.stack([1.0 - score, score], axis=1)

    # ----------------------------
    # Heatmap building
    # ----------------------------
    @staticmethod
    def _lime_weights_to_pixel_heatmap(explanation, label: int) -> np.ndarray:
        segments: np.ndarray = explanation.segments
        weights_list = explanation.local_exp[label]
        seg2w = {int(seg_id): float(w) for seg_id, w in weights_list}

        heat = np.zeros_like(segments, dtype=np.float32)
        for seg_id in np.unique(segments):
            heat[segments == seg_id] = np.float32(seg2w.get(int(seg_id), 0.0))
        return heat

    # ----------------------------
    # Public API
    # ----------------------------
    def explain(
            self,
            x: torch.Tensor,
            target_label: str,
            base_image: np.ndarray,
            overlay_cfg: OverlayConfig,
            **kwargs,
    ) -> np.ndarray:

        run_id = uuid.uuid4().hex[:12]
        self.logger.info(
            f"START LIME viz (run_id={run_id}, target_label='{target_label}', "
            f"num_samples={self._num_samples}, n_segments={self._slic_n_segments})"
        )

        if not hasattr(self._model, "pathologies"):
            raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

        pathologies = list(self._model.pathologies)
        if target_label not in pathologies:
            raise ValueError(f"Unknown label '{target_label}'. Available: {pathologies}")

        class_idx = pathologies.index(target_label)
        device = DetectorHelpers.get_model_device(self._model)

        # LIME perturbation base (RGB in [0,1])
        img_rgb_for_lime = self._x_to_rgb01(x).astype(np.float64)

        # Display base (also RGB01)
        if base_image is None:
            base_rgb01 = img_rgb_for_lime.astype(np.float32)
        else:
            base_gray = XaiHelpers.ensure_gray_01(base_image)
            if base_gray.shape != img_rgb_for_lime.shape[:2]:
                raise ValueError("base_image must match x spatial dimensions.")
            base_rgb01 = XaiHelpers.gray_to_rgb01(base_gray)

        predict_fn = lambda imgs: self._predict_proba_for_lime(imgs, class_idx=class_idx, device=device)

        explanation = self._explainer.explain_instance(
            img_rgb_for_lime,
            classifier_fn=predict_fn,
            hide_color=0,
            num_samples=self._num_samples,
            segmentation_fn=self._segmentation_fn,
        )

        # Superpixel weights -> pixel heat (signed)
        heat = self._lime_weights_to_pixel_heatmap(explanation, label=1)

        # Normalize nicely to [-1,1]
        heat_norm = XaiHelpers.clip_and_normalize_signed(heat, clip_percentile=overlay_cfg.clip_percentile)

        # Pretty smoothing (visual-only)
        if self._heat_blur_sigma > 0.0:
            heat_norm = gaussian_filter(heat_norm, sigma=self._heat_blur_sigma).astype(np.float32)
            heat_norm = np.clip(heat_norm, -1.0, 1.0)

        # Signed overlay render (returns uint8 RGB)
        result_u8 = XaiHelpers.render_signed_overlay_rgb01(
            base_rgb01=base_rgb01,
            signed_heat=heat_norm,
            cfg=overlay_cfg,
        )

        self.logger.info(f"END LIME viz (run_id={run_id}, result_shape={result_u8.shape})")
        return result_u8
