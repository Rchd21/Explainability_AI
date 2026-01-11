/**
 * ApiService.js
 * 
 * Generic HTTP service for API communication through Nginx reverse proxy.
 * Handles requests, responses, and error handling for detector backends.
 * 
 * All requests are routed through:
 * /detectors_backend/<service_name>/<path> -> http://<service_name>:8000/<path>
 */

import { config } from './Config.js';
import { eventBus, Events } from './EventBus.js';

class ApiService {
    constructor() {
        this._defaultHeaders = {
            'Accept': 'application/json'
        };
    }

    /**
     * Build URL for a detector endpoint using proxy routing
     * @param {string} detectorKey - Detector key ('lungCancer' or 'audioFake')
     * @param {string} endpointPath - Endpoint path
     * @param {Object} queryParams - Optional query parameters
     * @returns {string} Full URL through proxy
     */
    buildDetectorUrl(detectorKey, endpointPath, queryParams = {}) {
        return config.buildDetectorUrl(detectorKey, endpointPath, queryParams);
    }

    /**
     * Ping a detector backend to check health status
     * @param {string} detectorKey - Detector key
     * @returns {Promise<Object>} Ping result { success: boolean, latency?: number, error?: string }
     */
    async pingDetector(detectorKey) {
        const startTime = performance.now();
        const url = config.getPingUrl(detectorKey);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.settings.pingTimeout);

            const response = await fetch(url, {
                method: 'GET',
                headers: this._defaultHeaders,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const latency = Math.round(performance.now() - startTime);

            if (response.ok) {
                return { success: true, latency };
            } else {
                return { 
                    success: false, 
                    latency,
                    error: `HTTP ${response.status}` 
                };
            }
        } catch (error) {
            const latency = Math.round(performance.now() - startTime);
            
            if (error.name === 'AbortError') {
                return { success: false, latency, error: 'Timeout' };
            }
            
            return { 
                success: false, 
                latency,
                error: error.message || 'Network error' 
            };
        }
    }

    /**
     * Make a GET request to a detector endpoint
     * @param {string} detectorKey - Detector key
     * @param {string} endpointPath - Endpoint path
     * @param {Object} queryParams - Query parameters
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async getFromDetector(detectorKey, endpointPath, queryParams = {}, options = {}) {
        const url = this.buildDetectorUrl(detectorKey, endpointPath, queryParams);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { ...this._defaultHeaders, ...options.headers },
                signal: options.signal
            });

            return await this._handleResponse(response);
        } catch (error) {
            return this._handleError(error, detectorKey, endpointPath);
        }
    }

    /**
     * Make a POST request to a detector endpoint
     * Supports both JSON and FormData bodies
     * @param {string} detectorKey - Detector key
     * @param {string} endpointPath - Endpoint path
     * @param {Object|FormData} body - Request body (JSON object or FormData)
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async postToDetector(detectorKey, endpointPath, body, options = {}) {
        const url = this.buildDetectorUrl(detectorKey, endpointPath);
        
        // Determine content type and body format
        const isFormData = body instanceof FormData;
        const headers = { ...this._defaultHeaders, ...options.headers };
        
        // For JSON, set content type; for FormData, let browser set it
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: isFormData ? options.headers : headers,
                body: isFormData ? body : JSON.stringify(body),
                signal: options.signal
            });

            return await this._handleResponse(response);
        } catch (error) {
            return this._handleError(error, detectorKey, endpointPath);
        }
    }

    /**
     * Handle API response
     * @param {Response} response - Fetch response
     * @returns {Promise<any>} Parsed response data
     */
    async _handleResponse(response) {
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;

            try {
                error.data = await response.json();
            } catch {
                error.data = null;
            }

            throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return null;
        }

        return response.json();
    }

    /**
     * Handle API errors
     * @param {Error} error - Error object
     * @param {string} detectorKey - Detector key
     * @param {string} endpointPath - Endpoint path
     */
    _handleError(error, detectorKey, endpointPath) {
        // Don't report aborted requests
        if (error.name === 'AbortError') {
            console.log(`[ApiService] Request aborted: ${detectorKey} ${endpointPath}`);
            throw error;
        }

        console.error(`[ApiService] Error on ${detectorKey} ${endpointPath}:`, error);

        eventBus.emit(Events.API_ERROR, {
            detectorKey,
            endpointPath,
            error: error.message,
            status: error.status || null
        });

        throw error;
    }
}

export const apiService = new ApiService();
