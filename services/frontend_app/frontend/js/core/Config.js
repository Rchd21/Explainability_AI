/**
 * Config.js
 * 
 * Application configuration and constants.
 * Defines API endpoints using proxy-based routing through Nginx.
 * 
 * All API calls go through the Nginx reverse proxy:
 * /detectors_backend/<service_name>/<path> -> http://<service_name>:8000/<path>
 */

class Config {
    constructor() {
        // Proxy base path for all detector services
        this._proxyBasePath = '/detectors_backend';

        // Detector services configuration
        // Each service is accessible via: /detectors_backend/<serviceName>/<endpoint>
        this._detectors = {
            lungCancer: {
                serviceName: 'lung_cancer_detection',
                displayName: 'Lung Cancer Detection',
                detectPath: '/detector/lung_cancer_detection',
                pingPath: '/health/ping'
            },
            audioFake: {
                serviceName: 'deepfake_audio_detection',
                displayName: 'Deepfake Audio Detection',
                detectPath: '/detector/fake_audio_detection',
                pingPath: '/health/ping'
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
            requestTimeout: 60000, // 60 seconds for model inference
            pingInterval: 5000,    // 5 seconds between health pings
            pingTimeout: 3000      // 3 seconds timeout for ping requests
        };
    }

    /**
     * Get the proxy base path
     * @returns {string} Proxy base path
     */
    get proxyBasePath() {
        return this._proxyBasePath;
    }

    /**
     * Get all detector configurations
     * @returns {Object} Detectors configuration
     */
    get detectors() {
        return this._detectors;
    }

    /**
     * Get detector configuration by key
     * @param {string} detectorKey - Detector key ('lungCancer' or 'audioFake')
     * @returns {Object|null} Detector configuration
     */
    getDetector(detectorKey) {
        return this._detectors[detectorKey] || null;
    }

    /**
     * Build the full URL for a detector endpoint
     * Uses window.location.origin + proxy path
     * @param {string} detectorKey - Detector key
     * @param {string} endpointPath - Endpoint path (e.g., '/detector/lung_cancer_detection')
     * @param {Object} queryParams - Optional query parameters
     * @returns {string} Full URL
     */
    buildDetectorUrl(detectorKey, endpointPath, queryParams = {}) {
        const detector = this._detectors[detectorKey];
        if (!detector) {
            throw new Error(`Unknown detector: ${detectorKey}`);
        }

        // Build base URL: origin + proxy + service name + endpoint
        const baseUrl = `${window.location.origin}${this._proxyBasePath}/${detector.serviceName}${endpointPath}`;
        
        // Add query parameters if provided
        const url = new URL(baseUrl);
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        return url.toString();
    }

    /**
     * Get the detect endpoint URL for a detector
     * @param {string} detectorKey - Detector key
     * @returns {string} Full detect URL
     */
    getDetectUrl(detectorKey) {
        const detector = this._detectors[detectorKey];
        if (!detector) {
            throw new Error(`Unknown detector: ${detectorKey}`);
        }
        return this.buildDetectorUrl(detectorKey, detector.detectPath);
    }

    /**
     * Get the ping endpoint URL for a detector
     * @param {string} detectorKey - Detector key
     * @returns {string} Full ping URL
     */
    getPingUrl(detectorKey) {
        const detector = this._detectors[detectorKey];
        if (!detector) {
            throw new Error(`Unknown detector: ${detectorKey}`);
        }
        return this.buildDetectorUrl(detectorKey, detector.pingPath);
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
