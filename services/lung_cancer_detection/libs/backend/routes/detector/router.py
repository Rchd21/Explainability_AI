from fastapi import APIRouter, UploadFile, File, Form
import tempfile
import os
import json

from ...utils.error_handling import auto_handle_errors
from ...context import CONTEXT
from .models import LungCancerDetectionRequest, LungCancerDetectionResponse

router = APIRouter()

@auto_handle_errors
@router.post("/lung_cancer_detection", response_model=LungCancerDetectionResponse)
def lung_detection(
    request: str = Form(...),
    file: UploadFile = File(...)
) -> LungCancerDetectionResponse:
    # ✅ convertir la string JSON en objet Pydantic
    request_obj = LungCancerDetectionRequest(**json.loads(request))

    filename = file.filename or "upload.png"
    suffix = os.path.splitext(filename)[-1].lower() or ".png"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        result = CONTEXT.lung_detector.detect(
            image_path=tmp_path,
            xai_methods=request_obj.xai_methods,
            target_label=request_obj.target_label
        )
        return LungCancerDetectionResponse(**result)

    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
