# ====== Code Summary ======
# Defines the FastAPI route for lung cancer detection, handling image upload, form-based XAI method selection,
# model inference, XAI explanation rendering, and structured response generation with logging and cleanup.

# ====== Standard Library Imports ======
from pathlib import Path
import tempfile
import time
import os

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, Depends, File, UploadFile

# ====== Internal Project Imports ======
from ...context import CONTEXT
from ...utils.error_handling import auto_handle_errors
from .helpers import RouteDetectorHelpers
from .models import LungCancerDetectionRequest, LungCancerDetectionResponse

# ====== Router Configuration ======
router = APIRouter()


@auto_handle_errors
@router.post("/lung_cancer_detection", response_model=LungCancerDetectionResponse)
async def lung_detection(
        request: LungCancerDetectionRequest = Depends(LungCancerDetectionRequest.as_form),
        file: UploadFile = File(...),
) -> LungCancerDetectionResponse:
    """
    API endpoint for detecting lung cancer from an uploaded image, using a selected XAI method.

    Args:
        request (LungCancerDetectionRequest): Request model containing the XAI method.
        file (UploadFile): Uploaded medical image (e.g., CT scan) for analysis.

    Returns:
        LungCancerDetectionResponse: Prediction results, processing duration, and base64-encoded XAI image.
    """
    # 1. Start timing
    start_time = time.perf_counter()

    # 2. Extract and log input metadata
    filename = file.filename or "upload.png"
    suffix = (Path(filename).suffix or ".png").lower()

    CONTEXT.logger.info(
        f"[LUNG_DETECTION] Start | "
        f"xai_method={request.xai_method} | "
        f"filename={filename}"
    )

    tmp_path: str | None = None

    try:
        # 3. Create a temporary file to store the uploaded image
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        # 4. Write uploaded file content to temp file in chunks
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                out.write(chunk)

        # 5. Perform lung cancer detection using the model
        result = CONTEXT.detector.detect(
            image_path=tmp_path,
            xai_method=request.xai_method,
        )

        # 6. Measure duration
        duration = round(time.perf_counter() - start_time, 4)

        # 7. Convert XAI explanation (as list) to base64 PNG
        xai_image_base64 = RouteDetectorHelpers.xai_to_png_base64(result.xai_explain)

        # 8. Log completion
        CONTEXT.logger.info(
            f"[LUNG_DETECTION] Done | "
            f"xai_method={request.xai_method} | "
            f"filename={filename} | "
            f"duration={duration}s"
        )

        # 9. Return structured response
        return LungCancerDetectionResponse(
            detector_result=result,
            duration=duration,
            xai_image_base64=xai_image_base64,
        )

    finally:
        # 10. Cleanup file and resources
        await file.close()

        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                CONTEXT.logger.warning(
                    f"[LUNG_DETECTION] Cleanup failed | tmp_path={tmp_path}"
                )
