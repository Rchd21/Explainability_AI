# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import CONFIG

from detector.core import LungCancerDetector

class CONTEXT:
    config: CONFIG
    logger: LoggerPlusPlus

    lung_detector: LungCancerDetector 
