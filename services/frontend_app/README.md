# AI Detection Hub

A modern web application for AI-powered detection services, including lung cancer detection from CT scans and audio fake detection.

## Features

### Lung Cancer Detection
- Upload lung CT scan images (PNG, JPG, JPEG)
- Choose from multiple explainability (XAI) methods:
  - **Grad-CAM**: Gradient-weighted Class Activation Mapping
  - **LIME**: Local Interpretable Model-agnostic Explanations
  - **SHAP**: SHapley Additive exPlanations
- View AI prediction with confidence score
- Visualize the explainability heatmap showing which regions influenced the decision

### Audio Fake Detection (Coming Soon)
- Upload audio files (WAV, MP3, FLAC, OGG)
- Detect AI-generated or manipulated audio
- View spectrogram analysis

## Architecture

```
ai_detection_hub/
├── frontend/
│   ├── index.html          # Main HTML page
│   ├── styles.css          # CSS styles (dark/light theme)
│   └── js/
│       ├── app.js          # Main application entry
│       ├── core/           # Core modules
│       │   ├── Config.js   # API endpoints & configuration
│       │   ├── EventBus.js # Event system
│       │   └── State.js    # Application state
│       ├── components/     # Reusable UI components
│       │   ├── Toast.js    # Notifications
│       │   └── FileUpload.js # File upload handler
│       ├── services/       # API services
│       │   ├── LungCancerService.js
│       │   └── AudioFakeService.js
│       └── views/          # View controllers
│           ├── LungCancerView.js
│           └── AudioFakeView.js
├── nginx/
│   └── default.conf        # Nginx configuration
└── Dockerfile              # Docker build configuration
```

## API Endpoints

### Lung Cancer Detection
- **URL**: `http://lung_cancer_detection:8000/detector/lung_cancer_detection`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Parameters**:
  - `file`: Image file (PNG, JPG, JPEG)
  - `xai_method`: XAI method (`gradcam`, `lime`, `shap`)
- **Response**:
  ```json
  {
    "detector_result": {
      "prediction": 0,
      "confidence": 0.95,
      "xai_method": "gradcam"
    },
    "duration": 2.5,
    "xai_image_base64": "..."
  }
  ```

### Audio Fake Detection
- **URL**: `http://fake_audio_detector:8000/detector/fake_audio_detection`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Parameters**:
  - `file`: Audio file (WAV, MP3, FLAC, OGG)

## Development

### Running Locally

1. Serve the frontend files with any static file server:
   ```bash
   cd frontend
   python -m http.server 8080
   ```

2. Open `http://localhost:8080` in your browser

### Building Docker Image

```bash
docker build -t ai-detection-hub .
docker run -p 80:80 ai-detection-hub
```

## Configuration

Edit `frontend/js/core/Config.js` to update:
- API endpoint URLs
- XAI method definitions
- File size limits
- Toast notification duration

## Theme Support

The application supports both dark and light themes:
- Default: Dark theme
- Toggle: Click the theme button in the header
- Persistence: Theme preference is saved to localStorage

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

© 2025 AI Detection Hub. All rights reserved.

## Disclaimer

This tool is for educational and research purposes only. Always consult healthcare professionals for medical decisions.
