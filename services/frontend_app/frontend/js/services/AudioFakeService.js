/**
 * AudioFakeService.js
 * 
 * Service for communicating with the audio fake detection API.
 * Uses ApiService for proxy-based routing through Nginx.
 */

import { config } from '../core/Config.js';
import { apiService } from '../core/ApiService.js';

class AudioFakeService {
    constructor() {
        this._abortController = null;
        this._detectorKey = 'audioFake';
    }

    /**
     * Send audio for fake detection
     * @param {File} file - Audio file to analyze
     * @returns {Promise<Object>} Detection result
     */
    async detect(file) {
        // Cancel any pending request
        if (this._abortController) {
            this._abortController.abort();
        }
        
        this._abortController = new AbortController();

        const formData = new FormData();
        formData.append('file', file);

        const detector = config.getDetector(this._detectorKey);

        try {
            const result = await apiService.postToDetector(
                this._detectorKey,
                detector.detectPath,
                formData,
                { signal: this._abortController.signal }
            );

            return this._parseResult(result);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request was cancelled');
            }
            throw error;
        } finally {
            this._abortController = null;
        }
    }

    /**
     * Parse detection result
     * @param {Object} data - API response data
     * @returns {Object} Parsed result
     */
    _parseResult(data) {
        // This is a placeholder - adjust based on actual API response
        return {
            prediction: data.prediction || data.result,
            confidence: data.confidence || 0,
            label: this._getPredictionLabel(data.prediction || data.result),
            isFake: this._isFakePrediction(data.prediction || data.result),
            duration: data.duration || 0,
            audioLength: data.audio_length || null,
            spectrogramBase64: data.spectrogram_base64 || null,
            spectrogramUrl: data.spectrogram_base64 
                ? `data:image/png;base64,${data.spectrogram_base64}` 
                : null
        };
    }

    /**
     * Get human-readable prediction label
     * @param {*} prediction - Prediction value
     * @returns {string} Label
     */
    _getPredictionLabel(prediction) {
        if (typeof prediction === 'boolean') {
            return prediction ? 'Fake Audio Detected' : 'Authentic Audio';
        }
        if (typeof prediction === 'number') {
            return prediction === 1 ? 'Fake Audio Detected' : 'Authentic Audio';
        }
        if (typeof prediction === 'string') {
            const lower = prediction.toLowerCase();
            if (lower.includes('fake') || lower.includes('synthetic') || lower.includes('generated')) {
                return 'Fake Audio Detected';
            }
            return 'Authentic Audio';
        }
        return String(prediction);
    }

    /**
     * Determine if prediction indicates fake audio
     * @param {*} prediction - Prediction value
     * @returns {boolean} True if fake
     */
    _isFakePrediction(prediction) {
        if (typeof prediction === 'boolean') {
            return prediction;
        }
        if (typeof prediction === 'number') {
            return prediction === 1;
        }
        if (typeof prediction === 'string') {
            const lower = prediction.toLowerCase();
            return lower.includes('fake') || lower.includes('synthetic') || lower.includes('generated');
        }
        return false;
    }

    /**
     * Cancel pending request
     */
    cancel() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }
}

export const audioFakeService = new AudioFakeService();
