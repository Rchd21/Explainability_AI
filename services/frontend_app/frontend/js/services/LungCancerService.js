/**
 * LungCancerService.js
 * 
 * Service for communicating with the lung cancer detection API.
 * Uses ApiService for proxy-based routing through Nginx.
 */

import { config } from '../core/Config.js';
import { apiService } from '../core/ApiService.js';

class LungCancerService {
    constructor() {
        this._abortController = null;
        this._detectorKey = 'lungCancer';
    }

    /**
     * Send image for lung cancer detection
     * @param {File} file - Image file to analyze
     * @param {string} xaiMethod - XAI method to use
     * @returns {Promise<Object>} Detection result
     */
    async detect(file, xaiMethod) {
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
     * Parse detection result
     * @param {Object} data - API response data
     * @returns {Object} Parsed result
     */
    _parseResult(data) {
        const { detector_result, duration, xai_image_base64 } = data;
        
        // Extract lung_prediction from detector_result
        const lungPrediction = detector_result.lung_prediction || {};
        const decision = lungPrediction.decision || 'Unknown';
        const score = lungPrediction.score ?? 0;
        const threshold = lungPrediction.threshold ?? 0.5;
        
        // Determine if cancer is suspected
        const isPositive = this._isPositivePrediction(decision, score, threshold);
        
        return {
            // Prediction info
            decision: decision,
            score: score,
            threshold: threshold,
            label: decision,
            
            // XAI info
            xaiMethod: detector_result.xai_method,
            xaiImageBase64: xai_image_base64,
            xaiImageUrl: `data:image/png;base64,${xai_image_base64}`,
            
            // Meta
            duration: duration,
            isPositive: isPositive
        };
    }

    /**
     * Determine if prediction is positive (cancer suspected)
     * @param {string} decision - Decision string from API
     * @param {number} score - Confidence score
     * @param {number} threshold - Decision threshold
     * @returns {boolean} True if cancer suspected
     */
    _isPositivePrediction(decision, score, threshold) {
        // Check decision string
        if (typeof decision === 'string') {
            const lower = decision.toLowerCase();
            if (lower.includes('cancer') || lower.includes('suspected') || lower.includes('positive') || lower.includes('malignant')) {
                return true;
            }
            if (lower.includes('healthy') || lower.includes('normal') || lower.includes('negative')) {
                return false;
            }
        }
        
        // Fallback to score comparison
        return score >= threshold;
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

export const lungCancerService = new LungCancerService();
