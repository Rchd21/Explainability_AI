from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile

from ...context import CONTEXT
from ...utils.error_handling import auto_handle_errors
from .helpers import RouteDetectorHelpers
from .models import LungCancerDetectionRequest, LungCancerDetectionResponse

router = APIRouter()


@auto_handle_errors
@router.post("/lung_cancer_detection", response_model=LungCancerDetectionResponse)
async def lung_detection(
    request: LungCancerDetectionRequest = Depends(LungCancerDetectionRequest.as_form),
    file: UploadFile = File(...),
) -> LungCancerDetectionResponse:
    start_time = time.perf_counter()

    filename = file.filename or "upload.png"
    suffix = (Path(filename).suffix or ".png").lower()

    CONTEXT.logger.info(
        f"[LUNG_DETECTION] Start | "
        f"xai_method={request.xai_method} | "
        f"filename={filename}"
    )

    tmp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        # Run detection
        result = CONTEXT.detector.detect(
            image_path=tmp_path,
            xai_method=request.xai_method,
        )

        duration = round(time.perf_counter() - start_time, 4)

        # Convert XAI explain output to base64 PNG
        # result.xai_explain is currently a nested list because of .tolist()
        xai_image_base64 = RouteDetectorHelpers.xai_to_png_base64(result.xai_explain)

        CONTEXT.logger.info(
            f"[LUNG_DETECTION] Done | "
            f"xai_method={request.xai_method} | "
            f"filename={filename} | "
            f"duration={duration}s"
        )

        return LungCancerDetectionResponse(
            detector_result=result,
            duration=duration,
            xai_image_base64=xai_image_base64,
        )

    finally:
        await file.close()

        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                CONTEXT.logger.warning(
                    f"[LUNG_DETECTION] Cleanup failed | tmp_path={tmp_path}"
                )
