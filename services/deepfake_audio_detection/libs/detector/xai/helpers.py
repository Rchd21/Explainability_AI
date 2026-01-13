# ====== Code Summary ======
# Static helper utilities for handling image preprocessing, normalization,
# and visualization overlays (e.g., heatmaps) used in explainable AI (XAI) workflows.
# Includes utilities for image formatting, normalization, resizing, and rendering signed/unsigned overlays.

from __future__ import annotations

# ====== Standard Library Imports ======
from dataclasses import dataclass
from typing import Tuple

# ====== Third-Party Library Imports ======
import numpy as np
import tensorflow as tf

# ====== Local Project Imports ======
from .overlay_config import OverlayConfig


class XaiHelpers:
    """Full-static helper toolbox for all XAI explainers. Includes preprocessing and overlay rendering utilities."""

    def __new__(cls, *args, **kwargs) -> None:
        raise TypeError("XaiHelpers is a static utility class and cannot be instantiated.")

    # -------------------------
    # Image shape / dtype helpers
    # -------------------------

    @staticmethod
    def ensure_rgb(image: np.ndarray) -> np.ndarray:
        """
        Ensures input image has 3 RGB channels.

        Args:
            image (np.ndarray): Input image (grayscale, RGB, RGBA, etc.).

        Returns:
            np.ndarray: 3-channel RGB image.
        """
        img = np.asarray(image)

        # 1. Convert 2D grayscale to RGB
        if img.ndim == 2:
            img = np.stack([img] * 3, axis=-1)

        # 2. Convert single-channel (H,W,1) to RGB
        if img.ndim == 3 and img.shape[-1] == 1:
            img = np.concatenate([img] * 3, axis=-1)

        # 3. Remove alpha channel from RGBA (H,W,4)
        if img.ndim == 3 and img.shape[-1] == 4:
            img = img[:, :, :3]

        # 4. Validate final shape
        if img.ndim != 3 or img.shape[-1] != 3:
            raise ValueError(f"Expected image with shape (H,W,3). Got {img.shape}")

        return img

    @staticmethod
    def as_float01(x: np.ndarray) -> np.ndarray:
        """
        Converts an image to float32 in the [0,1] range.

        Args:
            x (np.ndarray): Input image array.

        Returns:
            np.ndarray: Float image with values clipped to [0.0, 1.0].
        """
        # 1. Convert to float32
        arr = np.asarray(x).astype(np.float32, copy=False)

        # 2. Normalize if needed
        mx = float(arr.max()) if arr.size else 0.0
        if mx > 1.0:
            arr = arr / 255.0

        # 3. Clip to [0.0, 1.0]
        return np.clip(arr, 0.0, 1.0)

    @staticmethod
    def ensure_rgb_uint8(image: np.ndarray) -> np.ndarray:
        """
        Converts an image to RGB format with uint8 dtype.

        Args:
            image (np.ndarray): Input image.

        Returns:
            np.ndarray: RGB image with dtype uint8.
        """
        img = XaiHelpers.ensure_rgb(image)

        # Return early if already uint8
        if img.dtype == np.uint8:
            return img

        # 1. Convert to float32
        x = img.astype(np.float32)

        # 2. Scale to 255 if in [0,1] range
        if float(x.max()) <= 1.0:
            x *= 255.0

        # 3. Convert to uint8
        return np.clip(x, 0, 255).astype(np.uint8)

    # -------------------------
    # Numeric helpers
    # -------------------------

    @staticmethod
    def normalize_01(arr: np.ndarray, eps: float = 1e-8) -> np.ndarray:
        """
        Normalizes input array to [0, 1] range.

        Args:
            arr (np.ndarray): Input array.
            eps (float): Small constant to avoid division by zero.

        Returns:
            np.ndarray: Normalized array.
        """
        # 1. Convert to float32
        x = np.asarray(arr, dtype=np.float32)

        # 2. Handle empty input
        if x.size == 0:
            return x

        # 3. Normalize to [0, 1]
        mn = float(x.min())
        mx = float(x.max())
        return (x - mn) / (mx - mn + eps)

    @staticmethod
    def clip_and_normalize_signed(heat: np.ndarray, clip_percentile: float = 99.0) -> np.ndarray:
        """
        Clips and normalizes a signed heatmap to [-1, 1].

        Args:
            heat (np.ndarray): Input heatmap (signed).
            clip_percentile (float): Percentile to clip at.

        Returns:
            np.ndarray: Clipped and normalized heatmap.
        """
        h = np.asarray(heat, dtype=np.float32)
        a = np.abs(h).reshape(-1)

        # 1. Handle empty input
        if a.size == 0:
            return h

        # 2. Determine clipping threshold
        thr = float(np.percentile(a, clip_percentile))
        if thr <= 1e-12:
            return np.zeros_like(h, dtype=np.float32)

        # 3. Clip and normalize
        return (np.clip(h, -thr, thr) / (thr + 1e-8)).astype(np.float32)

    @staticmethod
    def resize_2d(map2d: np.ndarray, size_hw: Tuple[int, int]) -> np.ndarray:
        """
        Resizes a 2D array to target (height, width) using bilinear interpolation.

        Args:
            map2d (np.ndarray): 2D input array.
            size_hw (Tuple[int, int]): Target (height, width) size.

        Returns:
            np.ndarray: Resized 2D array.
        """
        h, w = int(size_hw[0]), int(size_hw[1])
        m = np.asarray(map2d, dtype=np.float32)

        if m.ndim != 2:
            raise ValueError(f"resize_2d expects 2D array, got {m.shape}")
        if m.shape == (h, w):
            return m

        # 1. Resize using TensorFlow
        t = tf.convert_to_tensor(m[None, ..., None])  # (1, H, W, 1)
        r = tf.image.resize(t, (h, w), method="bilinear").numpy()
        return r[0, ..., 0].astype(np.float32)

    # -------------------------
    # Overlay helpers
    # -------------------------

    @staticmethod
    def signed_heat_to_rgba(
            signed_heat: np.ndarray,
            alpha_min: float,
            alpha_max: float,
            pos_rgb: tuple[float, float, float] = (1.0, 0.12, 0.12),
            neg_rgb: tuple[float, float, float] = (0.12, 0.12, 1.0),
    ) -> np.ndarray:
        """
        Converts signed heatmap to RGBA image for overlay.

        Args:
            signed_heat (np.ndarray): Normalized signed heatmap in [-1, 1].
            alpha_min (float): Minimum alpha value.
            alpha_max (float): Maximum alpha value.
            pos_rgb (tuple): RGB color for positive values.
            neg_rgb (tuple): RGB color for negative values.

        Returns:
            np.ndarray: RGBA image.
        """
        # 1. Clamp input
        h = np.clip(np.asarray(signed_heat, dtype=np.float32), -1.0, 1.0)
        mag = np.abs(h)

        # 2. Compute alpha channel
        a = alpha_min + (alpha_max - alpha_min) * mag
        a = np.clip(a, 0.0, 1.0).astype(np.float32)

        # 3. Allocate and assign RGBA values
        rgba = np.zeros((h.shape[0], h.shape[1], 4), dtype=np.float32)
        pos = h >= 0
        neg = ~pos
        rgba[pos, 0], rgba[pos, 1], rgba[pos, 2] = pos_rgb
        rgba[neg, 0], rgba[neg, 1], rgba[neg, 2] = neg_rgb
        rgba[..., 3] = a

        return rgba

    @staticmethod
    def alpha_blend(base_rgb01: np.ndarray, overlay_rgba01: np.ndarray) -> np.ndarray:
        """
        Alpha-blends an RGBA overlay on top of an RGB image.

        Args:
            base_rgb01 (np.ndarray): Base RGB image in [0,1].
            overlay_rgba01 (np.ndarray): Overlay RGBA image in [0,1].

        Returns:
            np.ndarray: Blended uint8 RGB image.
        """
        base = np.clip(np.asarray(base_rgb01, dtype=np.float32), 0.0, 1.0)
        over = np.clip(np.asarray(overlay_rgba01, dtype=np.float32), 0.0, 1.0)

        # 1. Validate shapes
        if base.ndim != 3 or base.shape[-1] != 3:
            raise ValueError(f"alpha_blend expects base RGB [H,W,3], got {base.shape}")
        if over.ndim != 3 or over.shape[-1] != 4:
            raise ValueError(f"alpha_blend expects overlay RGBA [H,W,4], got {over.shape}")

        # 2. Perform alpha blending
        a = over[..., 3:4]
        out = base * (1.0 - a) + over[..., :3] * a

        # 3. Convert to uint8
        return (np.clip(out, 0.0, 1.0) * 255.0).astype(np.uint8)

    @staticmethod
    def render_signed_overlay(base_image: np.ndarray, signed_heat: np.ndarray, cfg: OverlayConfig) -> np.ndarray:
        """
        Renders a signed heatmap overlay on top of an image.

        Args:
            base_image (np.ndarray): Base image.
            signed_heat (np.ndarray): Signed heatmap to overlay.
            cfg (OverlayConfig): Overlay parameters.

        Returns:
            np.ndarray: RGB uint8 overlayed image.
        """
        # 1. Prepare base image
        base_rgb01 = XaiHelpers.as_float01(XaiHelpers.ensure_rgb(base_image))
        h, w = base_rgb01.shape[:2]

        # 2. Resize heatmap to match base
        heat = np.asarray(signed_heat, dtype=np.float32)
        if heat.shape != (h, w):
            heat = XaiHelpers.resize_2d(heat, (h, w))

        # 3. Clip and normalize
        heat = XaiHelpers.clip_and_normalize_signed(heat, clip_percentile=cfg.clip_percentile)

        # 4. Convert heatmap to RGBA
        rgba = XaiHelpers.signed_heat_to_rgba(heat, alpha_min=cfg.alpha_min, alpha_max=cfg.alpha_max)

        # 5. Blend and return
        out = XaiHelpers.alpha_blend(base_rgb01, rgba)
        return XaiHelpers.ensure_rgb(out)

    @staticmethod
    def render_unsigned_overlay(
            base_image: np.ndarray,
            importance01: np.ndarray,
            cfg: OverlayConfig,
            color_rgb: tuple[float, float, float] = (1.0, 0.55, 0.0),
    ) -> np.ndarray:
        """
        Renders an unsigned (positive-only) overlay onto the base image.

        Args:
            base_image (np.ndarray): Image to overlay.
            importance01 (np.ndarray): Importance map in [0, 1].
            cfg (OverlayConfig): Overlay configuration.
            color_rgb (tuple): Overlay color.

        Returns:
            np.ndarray: Overlayed RGB image as uint8.
        """
        # 1. Prepare base
        base_rgb01 = XaiHelpers.as_float01(XaiHelpers.ensure_rgb(base_image))
        h, w = base_rgb01.shape[:2]

        # 2. Resize and clip importance map
        imp = np.asarray(importance01, dtype=np.float32)
        if imp.shape != (h, w):
            imp = XaiHelpers.resize_2d(imp, (h, w))
        imp = np.clip(imp, 0.0, 1.0)

        # 3. Compute alpha
        a = cfg.alpha_min + (cfg.alpha_max - cfg.alpha_min) * imp
        a = np.clip(a, 0.0, 1.0).astype(np.float32)

        # 4. Create RGBA overlay
        rgba = np.zeros((h, w, 4), dtype=np.float32)
        rgba[..., 0], rgba[..., 1], rgba[..., 2] = color_rgb
        rgba[..., 3] = a

        # 5. Blend and return
        out = XaiHelpers.alpha_blend(base_rgb01, rgba)
        return XaiHelpers.ensure_rgb(out)
