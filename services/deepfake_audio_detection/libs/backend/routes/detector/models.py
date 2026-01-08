from pydantic import BaseModel


# TODO: ici on définit les modèles qui définissent les entrées sorties des endpoints associé ici à /health (nom du dossier)

class DeepfakeAudioDetectionRequest(BaseModel):
    ...


class DeepfakeAudioDetectionResponse(BaseModel):
    ...
