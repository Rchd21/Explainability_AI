# ====== Code Summary ======
# Deepfake audio detection module for inference.
# Loads a pre-trained Keras model, generates MEL spectrograms from input audio,
# preprocesses them into image arrays, and performs classification to determine if the audio is real or fake.

from __future__ import annotations

# ====== Standard Library Imports ======
import tempfile
from pathlib import Path

# ====== Third-Party Library Imports ======
import numpy as np
import librosa
import librosa.display
import matplotlib
import matplotlib.pyplot as plt
import tensorflow as tf
from keras.preprocessing.image import load_img

# ====== Internal Project Imports ======
from loggerplusplus import LoggerClass
from public_models.detector import AudioPrediction

# Configure matplotlib for headless environments
matplotlib.use("Agg")


class AudioDetectorModel(LoggerClass):
    """
    Audio Deepfake Detection Model for performing inference using a trained Keras model.

    This class handles the full audio classification pipeline:
    - Model loading
    - Spectrogram generation
    - Preprocessing for model input
    - Inference and result formatting
    """

    CLASS_NAMES: list[str] = ["real", "fake"]
    TARGET_SIZE: tuple[int, int] = (224, 224)

    def __init__(self, model_path: str) -> None:
        """
        Initializes the detector with a given model path.

        Args:
            model_path (str): Directory path containing the Keras SavedModel.
        """
        super().__init__()
        self._model_path: str = model_path
        self.model: tf.keras.Model | None = None

        self.logger.info("Initialized AudioDetectorModel")
        self.logger.debug(f"Model path: {self._model_path}")

    def load_model(self) -> None:
        """
        Loads a trained Keras model from a directory.
        """
        self.logger.info(f"Loading model from: {self._model_path}")

        path = Path(self._model_path)
        if not path.exists():
            raise FileNotFoundError(f"Model not found at: {self._model_path}")

        if not path.is_dir():
            raise ValueError(
                f"Expected a model directory, but got a file: {self._model_path}"
            )

        self.model = tf.keras.models.load_model(str(path))
        self.logger.info("Model loaded successfully")

    def create_spectrogram(self, audio_path: str) -> tuple[object, str]:
        """
        Converts an audio file into a MEL spectrogram image and loads it as a PIL image.

        Args:
            audio_path (str): Path to the audio file.

        Returns:
            tuple[object, str]: The loaded image object and the path to the saved spectrogram image.
        """
        self.logger.info(f"Creating spectrogram for: {audio_path}")

        audio_file = Path(audio_path)
        if not audio_file.exists():
            raise FileNotFoundError(f"Audio file not found at: {audio_path}")

        # 1. Initialize figure
        fig = plt.figure()
        ax = fig.add_subplot(1, 1, 1)
        fig.subplots_adjust(left=0, right=1, bottom=0, top=1)

        # 2. Load audio and compute MEL spectrogram in log scale
        y, sr = librosa.load(str(audio_file))
        ms = librosa.feature.melspectrogram(y=y, sr=sr)
        log_ms = librosa.power_to_db(ms, ref=np.max)

        # 3. Plot and remove axis for clean image
        librosa.display.specshow(log_ms, sr=sr)
        ax.axis("off")

        # 4. Save spectrogram image to temporary PNG file
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            spectrogram_path = tmp.name

        plt.savefig(spectrogram_path)
        plt.close(fig)

        # 5. Reload the image as a PIL object for preprocessing
        image_data = load_img(spectrogram_path, target_size=self.TARGET_SIZE)

        self.logger.debug(f"Spectrogram saved to: {spectrogram_path}")
        return image_data, spectrogram_path

    def preprocess(self, audio_path: str) -> tuple[np.ndarray, np.ndarray, str]:
        """
        Converts an audio file into a normalized image array ready for model input.

        Args:
            audio_path (str): Path to the input audio file.

        Returns:
            tuple[np.ndarray, np.ndarray, str]: Model input array, original uint8 image array, image path.
        """
        self.logger.info(f"Preprocessing audio: {audio_path}")

        # 1. Generate spectrogram and load image
        image_data, spectrogram_path = self.create_spectrogram(audio_path)

        # 2. Convert image to NumPy array and keep a copy for visualization
        img_array = np.array(image_data)  # dtype: uint8
        explain_image = img_array.copy()

        # 3. Normalize and expand dimensions for model input
        img_array_normalized = img_array / 255.0
        model_input = np.expand_dims(img_array_normalized, axis=0).astype(np.float32)

        self.logger.debug(f"Model input shape: {model_input.shape}")
        self.logger.debug(f"Explain image shape: {explain_image.shape}")

        return model_input, explain_image, spectrogram_path

    def predict_raw(self, x: np.ndarray) -> np.ndarray:
        """
        Performs raw inference using the loaded model.

        Args:
            x (np.ndarray): Normalized image input with shape (1, 224, 224, 3).

        Returns:
            np.ndarray: Prediction probabilities per class.
        """
        if self.model is None:
            raise RuntimeError("Model is not loaded. Call load_model() first.")

        prediction = self.model.predict(x, verbose=0)
        return prediction

    def predict(self, x: np.ndarray) -> AudioPrediction:
        """
        Converts model prediction into a structured result.

        Args:
            x (np.ndarray): Normalized image input.

        Returns:
            AudioPrediction: Structured result containing label, confidence, and explanation.
        """
        self.logger.info("Generating prediction")

        # 1. Run inference
        prediction = self.predict_raw(x)

        # 2. Validate output shape
        if prediction.ndim != 2 or prediction.shape[0] < 1:
            raise ValueError(f"Unexpected prediction shape: {prediction.shape}")

        # 3. Interpret results
        class_index = int(np.argmax(prediction[0]))
        confidence = float(prediction[0][class_index])
        label = self.CLASS_NAMES[class_index]
        decision = "Fake Audio Detected" if label == "fake" else "Real Audio"

        self.logger.info(
            f"Prediction: {decision} | label={label} | confidence={confidence:.4f}"
        )

        return AudioPrediction(
            decision=decision,
            label=label,
            confidence=confidence,
            class_index=class_index,
        )

    def get_prediction_function(self):
        """
        Returns a prediction function suitable for image-based explanation tools (e.g. LIME).

        Returns:
            Callable[[np.ndarray], np.ndarray]: A prediction function for batch inference.
        """
        if self.model is None:
            raise RuntimeError("Model is not loaded. Call load_model() first.")

        def predict_fn(images: np.ndarray) -> np.ndarray:
            # 1. Ensure float dtype
            images = images.astype(np.float32)

            # 2. Normalize if necessary
            if images.max() > 1.0:
                images = images / 255.0

            return self.model.predict(images, verbose=0)

        return predict_fn
