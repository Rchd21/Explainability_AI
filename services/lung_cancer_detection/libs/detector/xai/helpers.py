# ====== Code Summary ======
# Static utility class providing tensor/image preprocessing and visualization
# helpers for PyTorch-based XAI (Explainable AI) pipelines.
# Includes grayscale and colormap conversions, normalization, overlay rendering,
# and support for both signed and unsigned heatmaps.

from __future__ import annotations

# ====== Third-Party Library Imports ======
import numpy as np
import torch

# ====== Local Project Imports ======
from .overlay_config import OverlayConfig


class XaiHelpers:
    """Full-static helper toolbox for all XAI explainers using PyTorch."""

    def __new__(cls, *args, **kwargs) -> None:
        raise TypeError("XaiHelpers is a static utility class and cannot be instantiated.")

    # -------------------------
    # Numeric helpers
    # -------------------------

    @staticmethod
    def normalize_01(arr: np.ndarray) -> np.ndarray:
        """
        Normalizes a numpy array to the [0,1] range.

        Args:
            arr (np.ndarray): Input array.

        Returns:
            np.ndarray: Normalized array in float32 [0,1].
        """
        x = np.asarray(arr, dtype=np.float32)
        if x.size == 0:
            return x
        mn = float(x.min())
        mx = float(x.max())
        return (x - mn) / (mx - mn + 1e-8)

    # -------------------------
    # Tensor/image helpers
    # -------------------------

    @staticmethod
    def tensor_to_grayscale_01(x: torch.Tensor) -> np.ndarray:
        """
        Converts a 4D PyTorch tensor to a normalized grayscale image.

        Args:
            x (torch.Tensor): Input tensor of shape [1, C, H, W].

        Returns:
            np.ndarray: Grayscale image [H, W] in float32 [0,1].
        """
        if x.ndim != 4 or x.shape[0] != 1:
            raise ValueError(f"Expected x shape [1,C,H,W], got {tuple(x.shape)}")

        # 1. Move to CPU and convert to NumPy
        x_np = x.detach().cpu().float().numpy()

        # 2. Mean across channels and normalize
        img = x_np[0].mean(axis=0)
        return XaiHelpers.normalize_01(img).astype(np.float32)

    @staticmethod
    def ensure_gray_01(gray: np.ndarray) -> np.ndarray:
        """
        Ensures grayscale image is in float32 [0,1] format.

        Args:
            gray (np.ndarray): Input grayscale image, potentially [0,255].

        Returns:
            np.ndarray: Clipped grayscale image in float32 [0,1].
        """
        g = np.asarray(gray, dtype=np.float32)
        if g.ndim != 2:
            raise ValueError(f"Expected grayscale [H,W], got {g.shape}")
        if float(g.max()) > 1.0:
            g = g / 255.0
        return np.clip(g, 0.0, 1.0).astype(np.float32)

    @staticmethod
    def gray_to_rgb01(gray01: np.ndarray) -> np.ndarray:
        """
        Converts a grayscale [H,W] image to RGB [H,W,3] with values in [0,1].

        Args:
            gray01 (np.ndarray): Grayscale input image in [0,1].

        Returns:
            np.ndarray: RGB image in [0,1].
        """
        g = XaiHelpers.ensure_gray_01(gray01)
        return np.stack([g, g, g], axis=-1)

    @staticmethod
    def to_uint8_rgb(img01_rgb: np.ndarray) -> np.ndarray:
        """
        Converts RGB image in float32 [0,1] to uint8 [0,255].

        Args:
            img01_rgb (np.ndarray): Input RGB image in [0,1].

        Returns:
            np.ndarray: RGB uint8 image in [0,255].
        """
        img = np.asarray(img01_rgb)
        if img.ndim != 3 or img.shape[2] != 3:
            raise ValueError(f"Expected RGB [H,W,3], got {img.shape}")
        return (np.clip(img.astype(np.float32), 0.0, 1.0) * 255.0).astype(np.uint8)

    # -------------------------
    # Colormap + overlay helpers
    # -------------------------

    @staticmethod
    def jet_colormap(heatmap_01: np.ndarray) -> np.ndarray:
        """
        Applies a pure-numpy 'jet' colormap approximation.

        Args:
            heatmap_01 (np.ndarray): Input heatmap in [0,1].

        Returns:
            np.ndarray: RGB image with jet colormap, in float32 [0,1].
        """
        h = np.clip(np.asarray(heatmap_01, dtype=np.float32), 0.0, 1.0)
        r = np.clip(1.5 - np.abs(4.0 * h - 3.0), 0.0, 1.0)
        g = np.clip(1.5 - np.abs(4.0 * h - 2.0), 0.0, 1.0)
        b = np.clip(1.5 - np.abs(4.0 * h - 1.0), 0.0, 1.0)
        return np.stack([r, g, b], axis=-1)

    @staticmethod
    def overlay_heatmap_unsigned(
            base_gray_01: np.ndarray,
            heatmap_01: np.ndarray,
            *,
            alpha: float = 0.45,
            threshold: float | None = None,
            colormap: str = "jet",
    ) -> np.ndarray:
        """
        Overlays an unsigned heatmap on top of a grayscale base image.

        Args:
            base_gray_01 (np.ndarray): Grayscale base image in [0,1].
            heatmap_01 (np.ndarray): Heatmap in [0,1].
            alpha (float): Alpha blending strength.
            threshold (float | None): Optional threshold to mask low-importance regions.
            colormap (str): Colormap name (currently only 'jet').

        Returns:
            np.ndarray: RGB float image in [0,1].
        """
        base = XaiHelpers.ensure_gray_01(base_gray_01)
        hm = np.clip(np.asarray(heatmap_01, dtype=np.float32), 0.0, 1.0)

        if base.shape != hm.shape:
            raise ValueError(f"base and heatmap must have same shape, got {base.shape} vs {hm.shape}")

        if threshold is not None:
            hm = np.where(hm >= float(threshold), hm, 0.0).astype(np.float32)

        base_rgb = np.stack([base, base, base], axis=-1)

        if colormap == "jet":
            hm_rgb = XaiHelpers.jet_colormap(hm)
        else:
            raise ValueError(f"Unsupported colormap: {colormap}")

        a = float(np.clip(alpha, 0.0, 1.0))
        out = (1.0 - a) * base_rgb + a * hm_rgb
        return np.clip(out, 0.0, 1.0).astype(np.float32)

    # -------------------------
    # Signed overlay helpers (LIME/SHAP style)
    # -------------------------

    @staticmethod
    def clip_and_normalize_signed(heat: np.ndarray, clip_percentile: float) -> np.ndarray:
        """
        Clips signed heatmap by percentile, then normalizes to [-1, 1].

        Args:
            heat (np.ndarray): Input signed heatmap.
            clip_percentile (float): Percentile to clip on abs values.

        Returns:
            np.ndarray: Clipped and normalized heatmap in [-1, 1].
        """
        h = np.asarray(heat, dtype=np.float32)
        a = np.abs(h).reshape(-1)
        if a.size == 0:
            return h

        thr = float(np.percentile(a, float(clip_percentile)))
        if thr <= 1e-12:
            return np.zeros_like(h, dtype=np.float32)

        h = np.clip(h, -thr, thr)
        return (h / (thr + 1e-8)).astype(np.float32)

    @staticmethod
    def signed_heat_to_rgba(
            heat_norm: np.ndarray,
            *,
            alpha_min: float,
            alpha_max: float,
            pos_rgb: tuple[float, float, float] = (1.0, 0.1, 0.1),
            neg_rgb: tuple[float, float, float] = (0.1, 0.1, 1.0),
    ) -> np.ndarray:
        """
        Converts a signed normalized heatmap to RGBA image:
        - Red for positive, blue for negative
        - Alpha scaled by magnitude

        Args:
            heat_norm (np.ndarray): Normalized signed heatmap in [-1, 1].
            alpha_min (float): Minimum alpha value.
            alpha_max (float): Maximum alpha value.
            pos_rgb (tuple): RGB color for positive values.
            neg_rgb (tuple): RGB color for negative values.

        Returns:
            np.ndarray: RGBA image in [0,1].
        """
        h = np.clip(np.asarray(heat_norm, dtype=np.float32), -1.0, 1.0)
        mag = np.abs(h)

        a = alpha_min + (alpha_max - alpha_min) * mag
        a = np.clip(a, 0.0, 1.0).astype(np.float32)

        rgba = np.zeros((h.shape[0], h.shape[1], 4), dtype=np.float32)
        pos = h >= 0
        neg = ~pos
        rgba[pos, 0], rgba[pos, 1], rgba[pos, 2] = pos_rgb
        rgba[neg, 0], rgba[neg, 1], rgba[neg, 2] = neg_rgb
        rgba[..., 3] = a

        return rgba

    @staticmethod
    def alpha_blend_rgb01_rgba01(base_rgb01: np.ndarray, overlay_rgba01: np.ndarray) -> np.ndarray:
        """
        Alpha blends an RGBA overlay on top of an RGB base image.

        Args:
            base_rgb01 (np.ndarray): RGB image in [0,1].
            overlay_rgba01 (np.ndarray): RGBA overlay in [0,1].

        Returns:
            np.ndarray: Final RGB image as uint8 [0,255].
        """
        base = np.clip(np.asarray(base_rgb01, dtype=np.float32), 0.0, 1.0)
        over = np.clip(np.asarray(overlay_rgba01, dtype=np.float32), 0.0, 1.0)

        if base.ndim != 3 or base.shape[2] != 3:
            raise ValueError(f"Expected base RGB [H,W,3], got {base.shape}")
        if over.ndim != 3 or over.shape[2] != 4:
            raise ValueError(f"Expected overlay RGBA [H,W,4], got {over.shape}")

        a = over[..., 3:4]
        out = base * (1.0 - a) + over[..., :3] * a
        return XaiHelpers.to_uint8_rgb(out)

    @staticmethod
    def render_signed_overlay_rgb01(
            base_rgb01: np.ndarray,
            signed_heat: np.ndarray,
            cfg: OverlayConfig,
    ) -> np.ndarray:
        """
        Renders a signed heatmap overlay on top of an RGB image.

        Args:
            base_rgb01 (np.ndarray): Base RGB image in [0,1].
            signed_heat (np.ndarray): Signed heatmap.
            cfg (OverlayConfig): Overlay configuration.

        Returns:
            np.ndarray: Final RGB image as uint8 [0,255].
        """
        base = np.clip(np.asarray(base_rgb01, dtype=np.float32), 0.0, 1.0)
        if base.ndim != 3 or base.shape[2] != 3:
            raise ValueError(f"Expected base RGB [H,W,3], got {base.shape}")

        heat = np.asarray(signed_heat, dtype=np.float32)
        if heat.shape != base.shape[:2]:
            raise ValueError(f"signed_heat must match spatial shape, got {heat.shape} vs {base.shape[:2]}")

        heat_norm = XaiHelpers.clip_and_normalize_signed(heat, clip_percentile=cfg.clip_percentile)
        overlay_rgba = XaiHelpers.signed_heat_to_rgba(
            heat_norm,
            alpha_min=cfg.alpha_min,
            alpha_max=cfg.alpha_max,
        )
        return XaiHelpers.alpha_blend_rgb01_rgba01(base, overlay_rgba)
