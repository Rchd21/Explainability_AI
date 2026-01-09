from loggerplusplus import LoggerClass

from .lung_detection import LungDetectorModel
from .lung_explainability import gradcam_heatmap, lime_overlay


class LungCancerDetector(LoggerClass):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Chargement modèle une seule fois au démarrage du service
        self.detector_model = LungDetectorModel(
            weights="densenet121-res224-chex",
            threshold=0.5,
            cancer_keys=["Lung Lesion"]
        )

    def detect(self, image_path: str, xai_methods: list[str], target_label: str = "Lung Lesion") -> dict:
        # 1) Preprocess + prédiction
        x = self.detector_model.preprocess(image_path)
        pred = self.detector_model.predict(x)

        result = {
            "prediction": pred.__dict__,
            "xai": {}
        }

        # 2) XAI (filtrage par méthode demandée)
        if "gradcam" in xai_methods:
            cam = gradcam_heatmap(self.detector_model.model, x, target_label)
            result["xai"]["gradcam"] = cam.tolist()

        if "lime" in xai_methods:
            overlay = lime_overlay(self.detector_model.model, x, target_label, num_samples=1000)
            result["xai"]["lime_overlay"] = overlay.tolist()

        return result
