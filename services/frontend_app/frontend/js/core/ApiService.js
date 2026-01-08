/**
 * ApiService.js
 * 
 * Generic HTTP service for API communication.
 * Handles requests, responses, and error handling for multiple PFS apps.
 */

import { config } from './Config.js';
import { eventBus, Events } from './EventBus.js';

class ApiService {
    constructor() {
        this._defaultHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }
    
    /**
     * Build URL with query parameters for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {string} Complete URL
     */
    _buildUrl(appId, endpoint, params = {}) {
        const baseUrl = config.getApiBaseUrl(appId);
        const url = new URL(`${baseUrl}${endpoint}`, window.location.origin);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.append(key, value);
            }
        });
        
        return url.toString();
    }
    
    /**
     * Make a GET request for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async get(appId, endpoint, params = {}, options = {}) {
        const url = this._buildUrl(appId, endpoint, params);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { ...this._defaultHeaders, ...options.headers },
                signal: options.signal
            });
            
            return await this._handleResponse(response);
        } catch (error) {
            return this._handleError(error, appId, endpoint);
        }
    }
    
    /**
     * Make parallel GET requests to all apps
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Map of appId -> response data
     */
    async getFromAllApps(endpoint, params = {}, options = {}) {
        const apps = config.pfsApps;
        const results = {};
        
        const promises = apps.map(async (app) => {
            try {
                const data = await this.get(app.id, endpoint, params, options);
                results[app.id] = { success: true, data };
            } catch (error) {
                results[app.id] = { success: false, error: error.message };
            }
        });
        
        await Promise.all(promises);
        return results;
    }
    
    /**
     * Make a POST request for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Response data
     */
    async post(appId, endpoint, data = {}, options = {}) {
        const url = this._buildUrl(appId, endpoint, {});
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { ...this._defaultHeaders, ...options.headers },
                body: JSON.stringify(data),
                signal: options.signal
            });
            
            return await this._handleResponse(response);
        } catch (error) {
            return this._handleError(error, appId, endpoint);
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
     * @param {string} appId - PFS app identifier
     * @param {string} endpoint - API endpoint
     */
    _handleError(error, appId, endpoint) {
        // Don't report aborted requests
        if (error.name === 'AbortError') {
            console.log(`[ApiService] Request aborted: ${appId}${endpoint}`);
            throw error;
        }
        
        console.error(`[ApiService] Error on ${appId}${endpoint}:`, error);
        
        eventBus.emit(Events.DATA_ERROR, {
            appId,
            endpoint,
            error: error.message,
            status: error.status || null
        });
        
        throw error;
    }
    
    /**
     * Get the full URL for an endpoint
     * @param {string} appId - PFS app identifier
     * @param {string} endpoint - API endpoint
     * @returns {string} Full URL
     */
    getUrl(appId, endpoint) {
        const baseUrl = config.getApiBaseUrl(appId);
        return `${baseUrl}${endpoint}`;
    }
}

export const apiService = new ApiService();
