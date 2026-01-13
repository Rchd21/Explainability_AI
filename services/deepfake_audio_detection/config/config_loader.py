# ====== Code Summary ======
# Configuration loader for the deepfake audio detection application.
# Loads settings from environment variables and sets up logging.

# ====== Standard Library Imports ======
import pathlib
import sys
import os

# ====== Third-Party Library Imports ======
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats

loggerplusplus.remove()  # Avoid double logging
lpp_format = lpp_formats.ShortFormat(identifier_width=15)

# ====== Local Imports ======
from .helpers import env, safe_load_envs, ConfigMeta


# Load config from .env file if available
# safe_load_envs() -> .env is typically provided via docker-compose


class CONFIG(metaclass=ConfigMeta):
    """
    All configuration values exposed as class attributes.
    """
    ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
    LIBS_DIR = ROOT_DIR / "libs"
    
    # Add libs directory to Python path for imports
    sys.path.append(str(LIBS_DIR))
    
    # ───── FastAPI ─────
    FASTAPI_APP_NAME = env("FASTAPI_APP_NAME")
    BASE_API_PATH = env("BASE_API_PATH")
    
    # ───── Logging ─────
    CONSOLE_LEVEL = env("CONSOLE_LEVEL")
    FILE_LEVEL = env("FILE_LEVEL")
    
    ENABLE_CONSOLE = env("ENABLE_CONSOLE", cast=bool)
    ENABLE_FILE = env("ENABLE_FILE", cast=bool)
    
    # ───── Detector ─────
    DETECTOR_MODEL_PATH = ROOT_DIR / env("DETECTOR_MODEL_PATH")
    
    # ───── Built-in functions ─────
    def __repr__(self) -> str:
        return type(self).__repr__(self)
    
    def __str__(self) -> str:
        return type(self).__repr__(self)


# ────── Apply logger config ──────
if CONFIG.ENABLE_CONSOLE:
    loggerplusplus.add(
        sink=sys.stdout,
        level=CONFIG.CONSOLE_LEVEL,
        format=lpp_format,
    )

if CONFIG.ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=CONFIG.FILE_LEVEL,
        format=lpp_format,
        rotation="1 week",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
