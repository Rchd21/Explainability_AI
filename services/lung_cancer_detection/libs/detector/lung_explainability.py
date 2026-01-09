# services/lung_cancer_detection/detector/lung_explainability.py

from __future__ import annotations
import numpy as np
import torch
import torch.nn.functional as F
import torchxrayvision as xrv
from lime import lime_image
from skimage.segmentation import mark_boundaries



# ----------------------------
# Grad-CAM
# ----------------------------
def _find_last_conv(model: torch.nn.Module) -> torch.nn.Conv2d:
    last = None
    for m in model.modules():
        if isinstance(m, torch.nn.Conv2d):
            last = m
    if last is None:
        raise RuntimeError("Grad-CAM requires Conv2d layers (none found).")
    return last


def gradcam_heatmap(model: torch.nn.Module, x: torch.Tensor, target_label: str) -> np.ndarray:
    """
    model: TorchXRayVision model
    x: [1,1,224,224]
    target_label: str in model.pathologies
    returns: heatmap [224,224] in [0,1]
    """
    if not hasattr(model, "pathologies"):
        raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

    if target_label not in model.pathologies:
        raise ValueError(f"Unknown label '{target_label}'. Available: {model.pathologies}")

    class_idx = model.pathologies.index(target_label)
    target_layer = _find_last_conv(model)

    activations = None
    gradients = None

    def fwd_hook(_, __, output):
        nonlocal activations
        activations = output

    def bwd_hook(_, grad_in, grad_out):
        nonlocal gradients
        gradients = grad_out[0]

    h1 = target_layer.register_forward_hook(fwd_hook)
    h2 = target_layer.register_full_backward_hook(bwd_hook)

    out = model(x)
    model.zero_grad(set_to_none=True)
    score = out[0, class_idx]
    score.backward()

    h1.remove()
    h2.remove()

    weights = gradients.mean(dim=(2, 3), keepdim=True)     # [1,C,1,1]
    cam = (weights * activations).sum(dim=1)               # [1,H,W]
    cam = F.relu(cam)

    cam = F.interpolate(cam.unsqueeze(1), size=(x.shape[2], x.shape[3]), mode="bilinear", align_corners=False)
    cam = cam.squeeze().detach().cpu().numpy()

    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    return cam


# ----------------------------
# LIME
# ----------------------------

def _x_to_rgb01(x: torch.Tensor) -> np.ndarray:
    img = x[0, 0].detach().cpu().numpy()
    img01 = (img - img.min()) / (img.max() - img.min() + 1e-8)
    return np.stack([img01, img01, img01], axis=-1)


def lime_overlay(
    model: torch.nn.Module,
    x: torch.Tensor,
    target_label: str,
    num_samples: int = 1000,
    num_features: int = 10,
) -> np.ndarray:
    """
    LIME forcé sur un seul label (ex: 'Lung Lesion').
    On transforme la sortie multi-label en sortie binaire 2 colonnes:
      col0 = 1 - score(label)
      col1 = score(label)   <-- c'est cette classe que LIME explique
    Retour: overlay [224,224,3] float in [0,1]
    """

    if not hasattr(model, "pathologies"):
        raise ValueError("Model must have .pathologies (TorchXRayVision DenseNet).")

    if target_label not in model.pathologies:
        raise ValueError(f"Unknown label '{target_label}'. Available: {model.pathologies}")

    class_idx = model.pathologies.index(target_label)
    device = next(model.parameters()).device

    img_rgb = _x_to_rgb01(x)

    def predict_fn(images_rgb: np.ndarray) -> np.ndarray:
        xs = []
        for im in images_rgb:
            gray01 = im.mean(axis=2)  # [0,1]
            gray = xrv.datasets.normalize(gray01, 1)

            gray = gray[np.newaxis, :, :]  # (1,H,W)
            gray = xrv.datasets.XRayCenterCrop()(gray)
            gray = xrv.datasets.XRayResizer(224)(gray)

            xt = torch.from_numpy(gray).unsqueeze(0).float().to(device)  # [1,1,224,224]
            xs.append(xt)

        Xb = torch.cat(xs, dim=0)

        with torch.no_grad():
            out = model(Xb)  # [B, num_labels]
            score = out[:, class_idx]  # [B]

        # ✅ binaire 2 classes : [not_target, target]
        score = score.detach().cpu().numpy()
        score = np.clip(score, 0.0, 1.0)  # sécurité (certains modèles sortent déjà [0,1])
        probs = np.stack([1.0 - score, score], axis=1)  # [B,2]
        return probs

    explainer = lime_image.LimeImageExplainer()

    # ✅ on force LIME à expliquer la classe 1 = target_label
    explanation = explainer.explain_instance(
        img_rgb,
        classifier_fn=predict_fn,
        labels=(1,),
        hide_color=0,
        num_samples=num_samples,
    )

    # Ici, le label 1 est GARANTI (si LIME a tourné)
    temp, mask = explanation.get_image_and_mask(
        label=1,
        positive_only=True,
        num_features=num_features,
        hide_rest=False,
    )

    overlay = mark_boundaries(temp, mask)
    return np.clip(overlay, 0, 1)