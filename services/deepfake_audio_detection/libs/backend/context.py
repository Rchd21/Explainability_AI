# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import CONFIG

from detector import FakeAudioDetector


class CONTEXT:
    config: CONFIG
    logger: LoggerPlusPlus

    detector: FakeAudioDetector
