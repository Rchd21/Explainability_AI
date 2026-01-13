# ====== Code Summary ======
# Defines a lightweight FastAPI route for service health checking (`/ping`), returning a simple boolean response.


# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Internal Project Imports ======
from ...utils.error_handling import auto_handle_errors
from .models import PingResponse

# ====== Router Definition ======
router = APIRouter()


@auto_handle_errors
@router.get("/ping", response_model=PingResponse)
def ping() -> PingResponse:
    """
    Health check endpoint to verify the service is up and responsive.

    Returns:
        PingResponse: A response with `ok=True` if the service is healthy.
    """
    return PingResponse(ok=True)
