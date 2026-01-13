# ====== Code Summary ======
# FastAPI router for deepfake audio detection endpoint.
# Handles audio file upload, runs detection with optional XAI method,
# and returns both prediction and base64-encoded XAI visualization.

# ====== Standard Library Imports ======
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, Depends, File, UploadFile

# ====== Local Project Imports ======
from ...context import CONTEXT
from ...utils.error_handling import auto_handle_errors
from .helpers import RouteDetectorHelpers
from .models import DeepfakeAudioDetectionRequest, DeepfakeAudioDetectionResponse

# ====== Router Definition ======
router = APIRouter()


@auto_handle_errors
@router.post("/fake_audio_detection", response_model=DeepfakeAudioDetectionResponse)
async def fake_audio_detection(
        request: DeepfakeAudioDetectionRequest = Depends(DeepfakeAudioDetectionRequest.as_form),
        file: UploadFile = File(...),
) -> DeepfakeAudioDetectionResponse:
    """
    Detect if an uploaded audio file is real or generated (e.g., by AI),
    using the configured detector and XAI method.

    Args:
        request (DeepfakeAudioDetectionRequest): Request metadata including the XAI method to apply.
        file (UploadFile): Uploaded audio file (e.g., WAV or MP3) to be analyzed.

    Returns:
        DeepfakeAudioDetectionResponse: Detection result with prediction label,
        optional explanation image (base64 PNG), and processing duration.
    """
    # 1. Start the timer
    start_time = time.perf_counter()

    # 2. Resolve filename and suffix
    filename = file.filename or "upload.wav"
    suffix = (Path(filename).suffix or ".wav").lower()

    CONTEXT.logger.info(
        f"[AUDIO_DETECTION] Start | "
        f"xai_method={request.xai_method} | "
        f"filename={filename}"
    )

    tmp_path: str | None = None

    try:
        # 3. Create a temporary file on disk
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        # 4. Save uploaded file contents to the temp file
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # Read in 1MB chunks
                if not chunk:
                    break
                out.write(chunk)

        # 5. Perform deepfake detection using the context's detector
        result = CONTEXT.detector.detect(
            audio_path=tmp_path,
            xai_method=request.xai_method
        )

        # 6. Calculate processing duration
        duration = round(time.perf_counter() - start_time, 4)

        # 7. Convert XAI explanation into base64 PNG image
        xai_image_base64 = RouteDetectorHelpers.xai_to_png_base64(result.xai_explain)

        CONTEXT.logger.info(
            f"[AUDIO_DETECTION] Done | "
            f"xai_method={request.xai_method} | "
            f"filename={filename} | "
            f"label={result.audio_prediction.label} | "
            f"duration={duration}s"
        )

        # 8. Return detection response
        return DeepfakeAudioDetectionResponse(
            detector_result=result,
            duration=duration,
            xai_image_base64=xai_image_base64
        )

    finally:
        # 9. Close the uploaded file object
        await file.close()

        # 10. Attempt to delete temporary file
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                CONTEXT.logger.warning(
                    f"[AUDIO_DETECTION] Cleanup failed | tmp_path={tmp_path}"
                )
