# ====== Code Summary ======
# Utility class for converting XAI explanation outputs (grayscale or RGB heatmaps) into base64-encoded PNG images.
# Supports lightweight logging for traceability during image conversion.

# ====== Standard Library Imports ======
from io import BytesIO
from typing import Any
import base64

# ====== Third-Party Library Imports ======
from loggerplusplus import loggerplusplus
from PIL import Image
import numpy as np


class RouteDetectorHelpers:
    """
    Collection of helper utilities for explainability (XAI) processing, including image conversion and export.
    """
    logger = loggerplusplus.bind(identifier="RouteDetectorHelpers")

    @classmethod
    def xai_to_png_base64(cls, xai_explain: Any) -> str:
        """
        Convert an XAI explanation (grayscale or RGB heatmap) to a PNG image encoded as base64.

        Supports:
            - Grayscale heatmap: [H, W] float in [0,1] or [0,255]
            - RGB overlay:       [H, W, 3] float in [0,1] or [0,255]

        Args:
            xai_explain (Any): The input explanation array-like object, e.g., list or np.ndarray.

        Returns:
            str: Base64-encoded PNG image (without data URI prefix).
        """
        # 1. Convert input to NumPy array
        a = np.asarray(xai_explain)
        cls.logger.debug(f"xai_to_png_base64: array shape={a.shape}, dtype={a.dtype}")

        # 2. Ensure numeric dtype
        if a.dtype == object:
            cls.logger.debug("xai_to_png_base64: casting object array to float32")
            a = a.astype(np.float32)

        # 3. Process grayscale heatmap
        if a.ndim == 2:
            cls.logger.debug("xai_to_png_base64: processing grayscale heatmap")
            arr = a.astype(np.float32)
            if float(arr.max()) <= 1.0:
                arr *= 255.0
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            img = Image.fromarray(arr, mode="L")

        # 4. Process RGB overlay
        elif a.ndim == 3 and a.shape[2] == 3:
            cls.logger.debug("xai_to_png_base64: processing RGB heatmap")
            arr = a.astype(np.float32)
            if float(arr.max()) <= 1.0:
                arr *= 255.0
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            img = Image.fromarray(arr, mode="RGB")

        # 5. Unsupported input shape
        else:
            cls.logger.debug(f"xai_to_png_base64: unsupported shape {a.shape}")
            raise ValueError(f"Unsupported xai_explain shape for image export: {a.shape}")

        # 6. Save image to buffer and encode
        buf = BytesIO()
        img.save(buf, format="PNG")
        cls.logger.debug("xai_to_png_base64: image saved to buffer")

        base64_result = base64.b64encode(buf.getvalue()).decode("utf-8")
        cls.logger.debug("xai_to_png_base64: base64 encoding complete")

        return base64_result
