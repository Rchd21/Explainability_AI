from enum import StrEnum


class XaiMethod(StrEnum):
    GRADCAM = "gradcam"
    LIME = "lime"
