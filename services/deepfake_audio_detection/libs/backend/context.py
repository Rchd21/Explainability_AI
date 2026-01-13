# ====== Code Summary ======
# Global application context holding shared instances.

# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import CONFIG
from detector.core import FakeAudioDetector


class CONTEXT:
    """
    Global context class holding shared application instances.
    
    Attributes:
        config: Application configuration
        logger: Logger instance
        detector: Fake audio detector instance
    """
    config: CONFIG
    logger: LoggerPlusPlus
    detector: FakeAudioDetector
