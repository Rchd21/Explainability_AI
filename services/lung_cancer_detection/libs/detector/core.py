from loggerplusplus import LoggerClass


# from .helpers import ... créer des dépendances sous classes au besoin pour un code léger


class FakeAudioDetector(LoggerClass):
    def __init__(self):
        LoggerClass.__init__(self)

    def detect(self):
        # TODO: to complete -> typage params & return
        ...
