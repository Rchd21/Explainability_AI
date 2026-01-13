# ====== Code Summary ======
# Defines a minimal Pydantic response model used to indicate the health or availability of the service.


# ====== Third-Party Library Imports ======
from pydantic import BaseModel


class PingResponse(BaseModel):
    """
    Response model for ping/health check endpoints.

    Attributes:
        ok (bool): Indicates whether the service is operational.
    """
    ok: bool
