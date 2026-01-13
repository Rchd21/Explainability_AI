# ====== Code Summary ======
# This module provides utility helpers for device management and model inspection,
# including automatic selection of the best available torch device and retrieving
# the current device of a PyTorch model.

# ====== Third-Party Library Imports ======
from loggerplusplus import loggerplusplus
import torch


class DetectorHelpers:
    """
    Utility helpers for device detection and model inspection.
    """

    logger = loggerplusplus.bind(identifier="DetectorHelpers")

    @classmethod
    def auto_device_detect(cls) -> torch.device:
        """
        Automatically select the best available device.

        Priority order:
            1) MPS (Apple Silicon)
            2) CUDA
            3) CPU

        Returns:
            torch.device: Selected device.
        """
        # 1. Check for MPS (Metal Performance Shaders - Apple Silicon)
        if torch.backends.mps.is_available():
            cls.logger.debug("Auto device detection selected MPS")
            return torch.device("mps")

        # 2. Check for CUDA (NVIDIA GPU)
        if torch.cuda.is_available():
            cls.logger.debug("Auto device detection selected CUDA")
            return torch.device("cuda")

        # 3. Fallback to CPU
        cls.logger.debug("Auto device detection selected CPU")
        return torch.device("cpu")

    @classmethod
    def get_model_device(cls, model: torch.nn.Module) -> torch.device:
        """
        Return the device on which a model is currently located.

        This inspects the first parameter of the model. If the model has
        no parameters, it safely falls back to CPU.

        Args:
            model (torch.nn.Module): PyTorch model.

        Returns:
            torch.device: Device where the model lives.
        """
        # 1. Get the first parameter of the model (or None)
        first_param: torch.nn.Parameter = next(model.parameters(), None)

        # 2. Handle model with no parameters
        if first_param is None:
            cls.logger.warning(
                "Model has no parameters; falling back to CPU device detection"
            )
            return torch.device("cpu")

        # 3. Return the device of the first parameter
        device: torch.device = first_param.device
        cls.logger.debug(f"Detected model device: {device}")
        return device
