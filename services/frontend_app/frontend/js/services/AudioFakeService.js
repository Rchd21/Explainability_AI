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
     * Send audio for fake detection with XAI explanation
     * @param {File} file - Audio file to analyze
     * @param {string} xaiMethod - XAI method to use (gradcam, lime, shap)
     * @returns {Promise<Object>} Detection result
     */
    async detect(file, xaiMethod = 'gradcam') {
        // Cancel any pending request
        if (this._abortController) {
            this._abortController.abort();
        }
        
        this._abortController = new AbortController();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('xai_method', xaiMethod);

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
     * Parse detection result from API response
     * @param {Object} data - API response data
     * @returns {Object} Parsed result
     */
    _parseResult(data) {
        const { detector_result, duration, xai_image_base64 } = data;
        
        // Extract audio_prediction from detector_result
        const audioPrediction = detector_result?.audio_prediction || {};
        const decision = audioPrediction.decision || 'Unknown';
        const label = audioPrediction.label || 'unknown';
        const confidence = audioPrediction.confidence ?? 0;
        const classIndex = audioPrediction.class_index ?? 0;
        
        // Determine if audio is fake
        const isFake = this._isFakePrediction(label, classIndex, decision);
        
        return {
            // Prediction info
            decision: decision,
            label: label,
            confidence: confidence,
            classIndex: classIndex,
            isFake: isFake,
            
            // XAI info
            xaiMethod: detector_result?.xai_method || 'gradcam',
            xaiImageBase64: xai_image_base64,
            xaiImageUrl: xai_image_base64 ? `data:image/png;base64,${xai_image_base64}` : null,
            
            // Meta
            duration: duration || 0
        };
    }

    /**
     * Determine if prediction indicates fake audio
     * @param {string} label - Prediction label
     * @param {number} classIndex - Class index (0=real, 1=fake)
     * @param {string} decision - Decision string
     * @returns {boolean} True if fake
     */
    _isFakePrediction(label, classIndex, decision) {
        // Check label string
        if (typeof label === 'string') {
            const lower = label.toLowerCase();
            if (lower === 'fake' || lower.includes('fake')) {
                return true;
            }
            if (lower === 'real' || lower.includes('real') || lower.includes('authentic')) {
                return false;
            }
        }
        
        // Check decision string
        if (typeof decision === 'string') {
            const lower = decision.toLowerCase();
            if (lower.includes('fake') || lower.includes('synthetic') || lower.includes('generated')) {
                return true;
            }
            if (lower.includes('real') || lower.includes('authentic')) {
                return false;
            }
        }
        
        // Fallback to class index (1 = fake)
        return classIndex === 1;
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
