from __future__ import annotations

# ====== Standard Library Imports ======
from collections.abc import Callable
from uuid import uuid4

# ====== Third-Party Imports ======
import numpy as np
import tensorflow as tf
from lime import lime_image
from scipy.ndimage import gaussian_filter
from skimage.segmentation import slic

# ====== Local Project Imports ======
from .base import XaiBase
from .overlay_config import OverlayConfig
from .helpers import XaiHelpers


class XaiLime(XaiBase):
    """Generate a LIME explanation overlay for image inputs.

    This implementation:
      1) Converts the provided image to float in [0, 1] for LIME.
      2) Uses SLIC to segment the image into superpixels.
      3) Runs LIME to obtain per-superpixel contribution weights.
      4) Expands weights into a pixel-level signed heatmap.
      5) Optionally applies Gaussian blur for smoother visuals.
      6) Renders a signed overlay via `XaiHelpers.render_signed_overlay`.

    Attributes:
        _num_samples: Number of LIME perturbation samples.
        _slic_n_segments: Number of SLIC superpixels.
        _slic_compactness: SLIC compactness parameter.
        _slic_sigma: SLIC smoothing parameter.
        _heat_blur_sigma: Gaussian blur sigma for visual smoothing (0 disables).
        _explainer: LIME image explainer instance.
        _segmentation_fn: Callable that segments an image into superpixel labels.
    """

    _num_samples: int
    _slic_n_segments: int
    _slic_compactness: float
    _slic_sigma: float
    _heat_blur_sigma: float
    _explainer: lime_image.LimeImageExplainer
    _segmentation_fn: Callable[[np.ndarray], np.ndarray]

    def __init__(
        self,
        model: tf.keras.Model,
        *,
        num_samples: int = 900,
        slic_n_segments: int = 350,
        slic_compactness: float = 10.0,
        slic_sigma: float = 0.8,
        heat_blur_sigma: float = 1.2,
    ) -> None:
        """Initialize the LIME explainer.

        Args:
            model (tf.keras.Model): Target model to explain.
            num_samples (int): Number of perturbed samples LIME generates.
            slic_n_segments (int): Number of superpixels used by SLIC.
            slic_compactness (float): Balances color proximity vs. space proximity in SLIC.
            slic_sigma (float): Smoothing applied before SLIC segmentation.
            heat_blur_sigma (float): Gaussian blur sigma applied to the pixel heatmap (0 disables).

        Raises:
            ValueError: If any numeric parameters are invalid.
        """
        super().__init__(model)

        self._num_samples = int(num_samples)
        self._slic_n_segments = int(slic_n_segments)
        self._slic_compactness = float(slic_compactness)
        self._slic_sigma = float(slic_sigma)
        self._heat_blur_sigma = float(heat_blur_sigma)

        self._explainer = lime_image.LimeImageExplainer()
        self._segmentation_fn = self._make_slic_segmenter(
            n_segments=self._slic_n_segments,
            compactness=self._slic_compactness,
            sigma=self._slic_sigma,
        )

        self.logger.info(
            "Initialized XaiLime "
            f"(num_samples={self._num_samples}, slic_n_segments={self._slic_n_segments}, "
            f"slic_compactness={self._slic_compactness}, slic_sigma={self._slic_sigma}, "
            f"heat_blur_sigma={self._heat_blur_sigma})"
        )

    def _predict_fn(self, images: np.ndarray) -> np.ndarray:
        """Prediction function passed to LIME.

        LIME provides images in float space; this function normalizes inputs to float32 in [0, 1]
        if needed and ensures a batch dimension.

        Args:
            images (np.ndarray): Image(s) with shape (H, W, C) or (N, H, W, C).

        Returns:
            np.ndarray: Model predictions with shape (N, num_classes).
        """
        imgs = images.astype(np.float32, copy=False)

        # Defensive normalization: if caller provides uint8-like range, rescale to [0, 1].
        if imgs.size > 0 and float(np.max(imgs)) > 1.0:
            imgs = imgs / 255.0

        if imgs.ndim == 3:
            imgs = np.expand_dims(imgs, axis=0)

        preds = self._model.predict(imgs, verbose=0)
        return np.asarray(preds)

    @staticmethod
    def _make_slic_segmenter(
        n_segments: int,
        compactness: float,
        sigma: float,
    ) -> Callable[[np.ndarray], np.ndarray]:
        """Create a SLIC segmentation function for LIME.

        Args:
            n_segments (int): Number of superpixels.
            compactness (float): SLIC compactness.
            sigma (float): Pre-segmentation smoothing.

        Returns:
            Callable[[np.ndarray], np.ndarray]: Function mapping image -> segment labels (H, W).
        """

        def segmenter(img: np.ndarray) -> np.ndarray:
            return slic(
                img,
                n_segments=int(n_segments),
                compactness=float(compactness),
                sigma=float(sigma),
                start_label=0,
            ).astype(np.int32, copy=False)

        return segmenter

    @staticmethod
    def _lime_weights_to_pixel_heatmap(explanation: object, label: int) -> np.ndarray:
        """Convert LIME superpixel weights into a pixel-level signed heatmap.

        Args:
            explanation (object): LIME explanation object (must expose `.segments` and `.local_exp`).
            label (int): Target label index.

        Returns:
            np.ndarray: Signed heatmap with shape (H, W), dtype float32.

        Raises:
            ValueError: If required fields are missing or malformed.
        """
        if not hasattr(explanation, "segments") or not hasattr(explanation, "local_exp"):
            raise ValueError("LIME explanation object is missing required attributes (segments/local_exp).")

        segments = np.asarray(getattr(explanation, "segments"))
        local_exp = getattr(explanation, "local_exp")

        if segments.ndim != 2:
            raise ValueError(f"Expected explanation.segments to have shape (H, W); got {segments.shape}.")

        # local_exp is typically dict[int, list[tuple[int, float]]]
        weights_list_obj = None
        if isinstance(local_exp, dict):
            weights_list_obj = local_exp.get(int(label))
            if weights_list_obj is None and len(local_exp) > 0:
                # Fallback: pick the first available label (keeps pipeline running).
                first_key = next(iter(local_exp.keys()))
                weights_list_obj = local_exp[first_key]
        if weights_list_obj is None:
            raise ValueError("No LIME local explanation weights found for the requested label.")

        weights_list = list(weights_list_obj)
        seg2w = {int(seg_id): float(w) for seg_id, w in weights_list}

        heat = np.zeros_like(segments, dtype=np.float32)
        for seg_id in np.unique(segments):
            heat[segments == seg_id] = np.float32(seg2w.get(int(seg_id), 0.0))

        return heat

    def explain(
        self,
        x: np.ndarray,
        class_index: int,
        base_image: np.ndarray,
        overlay_cfg: OverlayConfig,
    ) -> np.ndarray:
        """Explain an image prediction via LIME and return an overlay visualization.

        Args:
            x (np.ndarray): Input sample (accepted for API consistency; not used directly because
                this explainer operates on `base_image`).
            class_index (int): Class index to explain.
            base_image (np.ndarray): Image to visualize.
            overlay_cfg (OverlayConfig): Overlay rendering configuration.

        Returns:
            np.ndarray: RGB image (float or uint8 depending on `render_signed_overlay` contract)
                containing the LIME heat overlay.

        Raises:
            ValueError: If LIME explanation conversion fails.
            RuntimeError: If LIME fails internally.
        """
        run_id = uuid4().hex
        _ = x

        self.logger.info(
            f"START generating LIME overlay (run_id={run_id}, class_index={int(class_index)}, "
            f"num_samples={self._num_samples}, slic_n_segments={self._slic_n_segments})"
        )

        try:
            img01 = XaiHelpers.as_float01(XaiHelpers.ensure_rgb(base_image))
            height, width = int(img01.shape[0]), int(img01.shape[1])

            self.logger.debug(
                f"PROGRESS prepared input image for LIME (run_id={run_id}, height={height}, width={width}, "
                f"dtype={img01.dtype})"
            )

            explanation = self._explainer.explain_instance(
                img01.astype(np.float64),
                self._predict_fn,
                hide_color=0,
                num_samples=self._num_samples,
                segmentation_fn=self._segmentation_fn,
            )

            heat = self._lime_weights_to_pixel_heatmap(explanation, label=int(class_index))

            if self._heat_blur_sigma > 0.0:
                heat = gaussian_filter(heat.astype(np.float32), sigma=self._heat_blur_sigma).astype(np.float32)

            self.logger.debug(
                f"PROGRESS rendered heatmap (run_id={run_id}, blur_sigma={self._heat_blur_sigma}, "
                f"min={float(np.min(heat)):.4f}, max={float(np.max(heat)):.4f})"
            )

            result = XaiHelpers.render_signed_overlay(base_image=img01, signed_heat=heat, cfg=overlay_cfg)

            self.logger.info(
                f"END generating LIME overlay (run_id={run_id}, height={height}, width={width})"
            )
            return result
        except Exception as exc:
            self.logger.error(
                f"END generating LIME overlay with failure (run_id={run_id}, exc_type={type(exc).__name__}, "
                f"message={str(exc)})"
            )
            raise
