# ====== Code Summary ======
# Defines a health check endpoint (`/ping`) using FastAPI that returns a basic operational status response.


# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Local Project Imports ======
from ...utils.error_handling import auto_handle_errors
from .models import PingResponse

# ====== Router Definition ======
router = APIRouter()


@auto_handle_errors  # Decorator to ensure errors are handled gracefully to prevent app crashes
@router.get("/ping", response_model=PingResponse)
def ping() -> PingResponse:
    """
    Health check endpoint to verify that the service is operational.

    Returns:
        PingResponse: Response object indicating the service is healthy.
    """
    # 1. Construct and return a successful ping response
    return PingResponse(ok=True)
