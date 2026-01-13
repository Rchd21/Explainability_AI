# ====== Code Summary ======
# Immutable configuration object for controlling overlay transparency
# and clipping behavior in XAI (Explainable AI) visualizations.

from dataclasses import dataclass


@dataclass(frozen=True)
class OverlayConfig:
    """
    Immutable configuration class for controlling transparency and clipping
    behavior of visual overlays in explainable AI (XAI) applications.

    Attributes:
        alpha_max (float): Maximum alpha (opacity) value used in overlays.
        alpha_min (float): Minimum alpha (opacity) value used in overlays.
        clip_percentile (float): Percentile used for clipping values in signed heatmaps.
    """
    alpha_max: float = 0.70
    alpha_min: float = 0.05
    clip_percentile: float = 99.0
