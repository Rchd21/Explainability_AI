from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# TODO: ici on définit les modèles qui définissent les entrées sorties des endpoints associé ici à /health (nom du dossier)

# ---- Lung ----
class LungCancerDetectionRequest(BaseModel):
    # Quelles méthodes XAI appliquer
    xai_methods: List[str] = ["gradcam","lime"]  # ex: ["gradcam","lime"]
    # Label à expliquer (doit exister dans model.pathologies)
    target_label: str = "Lung Lesion"
    # Seuil proxy cancer
    threshold: float = 0.5


class LungCancerDetectionResponse(BaseModel):
    prediction: Dict[str, Any]
    xai: Dict[str, Any]