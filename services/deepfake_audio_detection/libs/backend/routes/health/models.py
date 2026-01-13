# ====== Code Summary ======
# Defines the response model for a health check or ping endpoint, indicating basic operational status.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel


class PingResponse(BaseModel):
    """
    Response model for a ping or health-check endpoint.

    Attributes:
        ok (bool): Indicates whether the service is up and running.
    """
    ok: bool
