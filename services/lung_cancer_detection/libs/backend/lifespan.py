# ====== Code Summary ======
# This module provides an async lifespan context manager for FastAPI applications.
# It logs lifecycle events, prints the runtime configuration, initializes the filter cache,
# and ensures proper shutdown of the application.

# ====== Standard Library Imports ======
from contextlib import asynccontextmanager

# ====== Third-party Library Imports ======
from pyfiglet import Figlet
import unicodedata

# ====== Local Project Imports ======
from .context import CONTEXT


def lifespan():
    """
    Returns an async context manager for FastAPI application lifespan events.

    The manager logs when the app starts and stops, displays runtime configuration,
    initializes services, and ensures proper shutdown.

    Returns:
        AsyncGenerator: An async context manager for application lifespan handling.
    """

    def log_step(step, total, message):
        CONTEXT.logger.info(f"\n[{step}/{total}] {message}...")

    @asynccontextmanager
    async def _lifespan(app):
        """
        Async context manager for FastAPI lifespan.

        Args:
            app: The FastAPI application instance.
        """
        try:
            # Banner
            banner = "\n" + Figlet(font="slant").renderText(
                text="".join(
                    c for c in unicodedata.normalize("NFD", CONTEXT.config.FASTAPI_APP_NAME)
                    if unicodedata.category(c) != "Mn"
                )
            )
            CONTEXT.logger.info(banner)
            CONTEXT.logger.info(f"🚀 Starting FastAPI-APP [{CONTEXT.config.FASTAPI_APP_NAME}]\n")

            # ─────────────────────────────────────────────
            # [1/3] Runtime configuration
            # ─────────────────────────────────────────────
            log_step(1, 3, "Loading runtime configuration")
            CONTEXT.logger.info(CONTEXT.config)
            CONTEXT.logger.info("✔ Runtime configuration loaded")

            # ─────────────────────────────────────────────
            # [2/3] Model loading
            # ─────────────────────────────────────────────
            log_step(2, 3, "Loading detector model")
            CONTEXT.detector.load_model()

            # ─────────────────────────────────────────────
            # [3/3] Ready
            # ─────────────────────────────────────────────
            log_step(3, 3, "Finalizing startup")
            CONTEXT.logger.info(f"✅ FastAPI-APP [{CONTEXT.config.FASTAPI_APP_NAME}] is ready!")

            yield
        finally:
            # 5. Log shutdown
            CONTEXT.logger.info("🛑 Shutting down...")

    return _lifespan
