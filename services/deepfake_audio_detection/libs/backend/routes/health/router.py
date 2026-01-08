# ====== Standard Library Imports ======
from typing import Any

# ====== Third-party Library Imports ======
from fastapi import APIRouter

# ====== Local Project Imports ======
from ...utils.error_handling import auto_handle_errors
from ...context import CONTEXT
# TODO: si y'a besoin d'utiliser des classes (exemple: classe dédié à la détection de fake audio, alors on ajoute un attribut au contexte et on l'utilise via le CONTEXT. Cette classe doit être instanciée dans l'entrypoint
from .models import PingResponse

# TODO: toujours définir un modèle pour cadré les données qui entre et sorte des endpoints

# ====== Router Definition ======
router = APIRouter()


# TODO: tjrs décorer le endpoint avec ce décorateur, il sécurise leur execution en cas d'erreur évite de faire crash l'app
@auto_handle_errors
@router.get("/ping", response_model=PingResponse)
def ping() -> PingResponse:
    return PingResponse(ok=True)
