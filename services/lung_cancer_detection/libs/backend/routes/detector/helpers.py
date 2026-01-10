# ====== Third-Party Library Imports ======
from __future__ import annotations

import base64
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image
from loggerplusplus import loggerplusplus


class RouteDetectorHelpers:
    logger = loggerplusplus.bind(identifier="RouteDetectorHelpers")

    @classmethod
    def xai_to_png_base64(cls, xai_explain: Any) -> str:
        """
        Convert an XAI explanation (list or numpy array) to a PNG encoded as base64.

        Supports:
          - Grayscale heatmap: [H, W] float in [0,1] or [0,255]
          - RGB overlay:       [H, W, 3] float in [0,1] or [0,255]

        Returns:
          Base64 string (no data-uri prefix).
        """
        a = np.asarray(xai_explain)

        # Ensure numeric dtype
        if a.dtype == object:
            a = a.astype(np.float32)

        if a.ndim == 2:
            arr = a.astype(np.float32)
            if float(arr.max()) <= 1.0:
                arr = arr * 255.0
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            img = Image.fromarray(arr, mode="L")

        elif a.ndim == 3 and a.shape[2] == 3:
            arr = a.astype(np.float32)
            if float(arr.max()) <= 1.0:
                arr = arr * 255.0
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            img = Image.fromarray(arr, mode="RGB")

        else:
            raise ValueError(f"Unsupported xai_explain shape for image export: {a.shape}")

        buf = BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")
