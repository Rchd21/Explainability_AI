# ====== Detector Module Exports ======
# Exposes the main detector classes.

from .core import FakeAudioDetector
from .model import AudioDetectorModel

__all__ = ["FakeAudioDetector", "AudioDetectorModel"]
