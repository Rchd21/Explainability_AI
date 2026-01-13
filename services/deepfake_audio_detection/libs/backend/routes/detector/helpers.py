# ====== Code Summary ======
# Helper functions for the detector route, specifically for converting XAI explanation arrays into base64-encoded PNG images.

# ====== Standard Library Imports ======
import base64
import io

# ====== Third-Party Library Imports ======
import numpy as np
from PIL import Image


class RouteDetectorHelpers:
    """
    Helper methods for the detector route.
    """

    @staticmethod
    def xai_to_png_base64(xai_explain: list[list[list[float]]]) -> str:
        """
        Convert a 3D XAI explanation array into a base64-encoded PNG string.

        Args:
            xai_explain (list[list[list[float]]]): Nested list representing an image with RGB values
                in the format [height][width][channels].

        Returns:
            str: A base64-encoded PNG string (without data URI prefix).
        """
        # 1. Convert the input list to a NumPy array with dtype uint8
        arr = np.array(xai_explain, dtype=np.uint8)

        # 2. Ensure the array has shape (H, W, 3) for RGB
        if arr.ndim == 2:
            # Case: Grayscale -> Stack into RGB
            arr = np.stack([arr] * 3, axis=-1)
        elif arr.ndim == 3 and arr.shape[-1] == 1:
            # Case: Single-channel -> Duplicate to RGB
            arr = np.concatenate([arr] * 3, axis=-1)

        # 3. Create a PIL Image object from the RGB array
        img = Image.fromarray(arr, mode='RGB')

        # 4. Save the image to an in-memory PNG buffer
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)

        # 5. Encode the PNG buffer content to base64 string
        base64_str = base64.b64encode(buffer.read()).decode('utf-8')

        # 6. Return the base64 string
        return base64_str
