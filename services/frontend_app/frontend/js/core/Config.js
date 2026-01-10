/**
 * Config.js
 * 
 * Application configuration and constants.
 * Defines API endpoints for different detection services.
 */

class Config {
    constructor() {
        // API Endpoints for different detectors
        this._endpoints = {
            lungCancer: {
                baseUrl: 'http://localhost:8882',
                detectPath: '/detector/lung_cancer_detection'
            },
            audioFake: {
                baseUrl: 'http://fake_audio_detector:8000',
                detectPath: '/detector/fake_audio_detection'
            }
        };

        // Available XAI methods for lung cancer detection
        this._xaiMethods = [
            {
                value: 'gradcam',
                name: 'Grad-CAM',
                description: 'Gradient-weighted Class Activation Mapping - Highlights important regions with a heatmap overlay',
                badge: 'Recommended',
                recommended: true
            },
            {
                value: 'lime',
                name: 'LIME',
                description: 'Local Interpretable Model-agnostic Explanations - Shows superpixel importance',
                badge: 'Interpretable',
                recommended: false
            }
        ];

        // Supported file types
        this._supportedFiles = {
            lungCancer: {
                accept: 'image/png,image/jpeg,image/jpg',
                extensions: ['.png', '.jpg', '.jpeg'],
                maxSize: 10 * 1024 * 1024 // 10MB
            },
            audioFake: {
                accept: 'audio/wav,audio/mp3,audio/mpeg,audio/flac,audio/ogg',
                extensions: ['.wav', '.mp3', '.flac', '.ogg'],
                maxSize: 50 * 1024 * 1024 // 50MB
            }
        };

        // Application settings
        this._settings = {
            toastDuration: 5000,
            requestTimeout: 60000 // 60 seconds for model inference
        };
    }

    /**
     * Get the full API URL for lung cancer detection
     * @returns {string} Full API URL
     */
    get lungCancerApiUrl() {
        const { baseUrl, detectPath } = this._endpoints.lungCancer;
        return `${baseUrl}${detectPath}`;
    }

    /**
     * Get the full API URL for audio fake detection
     * @returns {string} Full API URL
     */
    get audioFakeApiUrl() {
        const { baseUrl, detectPath } = this._endpoints.audioFake;
        return `${baseUrl}${detectPath}`;
    }

    /**
     * Get available XAI methods
     * @returns {Array} XAI methods configuration
     */
    get xaiMethods() {
        return this._xaiMethods;
    }

    /**
     * Get supported file configuration
     * @param {string} detector - Detector type ('lungCancer' or 'audioFake')
     * @returns {Object} File configuration
     */
    getSupportedFiles(detector) {
        return this._supportedFiles[detector] || null;
    }

    /**
     * Get application settings
     * @returns {Object} Settings object
     */
    get settings() {
        return this._settings;
    }

    /**
     * Validate file for a specific detector
     * @param {File} file - File to validate
     * @param {string} detector - Detector type
     * @returns {Object} Validation result { valid: boolean, error?: string }
     */
    validateFile(file, detector) {
        const config = this._supportedFiles[detector];
        
        if (!config) {
            return { valid: false, error: 'Unknown detector type' };
        }

        // Check file size
        if (file.size > config.maxSize) {
            const maxMB = config.maxSize / (1024 * 1024);
            return { valid: false, error: `File size exceeds ${maxMB}MB limit` };
        }

        // Check file extension
        const fileName = file.name.toLowerCase();
        const hasValidExtension = config.extensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
            return { 
                valid: false, 
                error: `Invalid file type. Supported: ${config.extensions.join(', ')}` 
            };
        }

        return { valid: true };
    }
}

export const config = new Config();
