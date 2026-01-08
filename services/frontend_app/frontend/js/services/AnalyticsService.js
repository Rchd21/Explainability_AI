/**
 * AnalyticsService.js
 * 
 * Service for interacting with the analytics API.
 * Provides methods for all analytics endpoints across multiple PFS apps.
 */

import { apiService } from '../core/ApiService.js';
import { config } from '../core/Config.js';

class AnalyticsService {
    
    // =========================================================================
    // Dashboard Endpoints
    // =========================================================================
    
    /**
     * Get dashboard summary statistics for a specific app
     * @param {string} appId - PFS app identifier
     * @param {number} days - Number of days to include
     * @returns {Promise<Object>} Dashboard summary data
     */
    async getDashboardSummary(appId, days = 30) {
        return apiService.get(appId, '/analytics/dashboard', { days });
    }
    
    /**
     * Get dashboard summaries from all apps
     * @param {number} days - Number of days to include
     * @returns {Promise<Object>} Map of appId -> summary data
     */
    async getAllDashboardSummaries(days = 30) {
        return apiService.getFromAllApps('/analytics/dashboard', { days });
    }
    
    /**
     * Get activity data by day for a specific app
     * @param {string} appId - PFS app identifier
     * @param {number} days - Number of days to include
     * @returns {Promise<Array>} Daily activity data
     */
    async getActivityByDay(appId, days = 30) {
        return apiService.get(appId, '/analytics/activity-by-day', { days });
    }
    
    /**
     * Get rating distribution for a specific app
     * @param {string} appId - PFS app identifier
     * @returns {Promise<Array>} Rating distribution data
     */
    async getRatingDistribution(appId) {
        return apiService.get(appId, '/analytics/rating-distribution');
    }
    
    /**
     * Get top queries for a specific app
     * @param {string} appId - PFS app identifier
     * @param {number} limit - Maximum number of queries
     * @param {number} days - Number of days to include
     * @returns {Promise<Array>} Top queries data
     */
    async getTopQueries(appId, limit = 20, days = 30) {
        return apiService.get(appId, '/analytics/top-queries', { limit, days });
    }
    
    /**
     * Get hourly activity distribution for a specific app
     * @param {string} appId - PFS app identifier
     * @param {number} days - Number of days to include
     * @returns {Promise<Array>} Hourly distribution data
     */
    async getHourlyDistribution(appId, days = 30) {
        return apiService.get(appId, '/analytics/hourly-distribution', { days });
    }
    
    /**
     * Get recent feedback for a specific app
     * @param {string} appId - PFS app identifier
     * @param {number} limit - Maximum number of feedback items
     * @returns {Promise<Array>} Recent feedback data
     */
    async getRecentFeedback(appId, limit = 20) {
        return apiService.get(appId, '/analytics/recent-feedback', { limit });
    }
    
    // =========================================================================
    // Clients Endpoints
    // =========================================================================
    
    /**
     * List clients with pagination and filters for a specific app
     * @param {string} appId - PFS app identifier
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Paginated clients list
     */
    async listClients(appId, params = {}) {
        return apiService.get(appId, '/analytics/clients', {
            limit: params.limit || 50,
            offset: params.offset || 0,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            search: params.search
        });
    }
    
    /**
     * List clients from all apps
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Map of appId -> clients data
     */
    async listClientsFromAllApps(params = {}) {
        return apiService.getFromAllApps('/analytics/clients', {
            limit: params.limit || 50,
            offset: params.offset || 0,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            search: params.search
        });
    }
    
    /**
     * Get client detail by ID for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} clientId - Client UUID
     * @returns {Promise<Object>} Client detail data
     */
    async getClientDetail(appId, clientId) {
        return apiService.get(appId, `/analytics/clients/${clientId}`);
    }
    
    /**
     * Get client activity timeline for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} clientId - Client UUID
     * @param {number} limit - Maximum items
     * @param {number} offset - Pagination offset
     * @returns {Promise<Object>} Client timeline data
     */
    async getClientTimeline(appId, clientId, limit = 100, offset = 0) {
        return apiService.get(appId, `/analytics/clients/${clientId}/timeline`, { limit, offset });
    }
    
    // =========================================================================
    // Sessions Endpoints
    // =========================================================================
    
    /**
     * List sessions with pagination and filters for a specific app
     * @param {string} appId - PFS app identifier
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Paginated sessions list
     */
    async listSessions(appId, params = {}) {
        return apiService.get(appId, '/analytics/sessions', {
            limit: params.limit || 50,
            offset: params.offset || 0,
            client_id: params.clientId,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            min_duration_minutes: params.minDuration
        });
    }
    
    /**
     * Get session detail by ID for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} sessionId - Session UUID
     * @returns {Promise<Object>} Session detail data
     */
    async getSessionDetail(appId, sessionId) {
        return apiService.get(appId, `/analytics/sessions/${sessionId}`);
    }
    
    /**
     * Get session activity timeline for a specific app
     * @param {string} appId - PFS app identifier
     * @param {string} sessionId - Session UUID
     * @returns {Promise<Object>} Session timeline data
     */
    async getSessionTimeline(appId, sessionId) {
        return apiService.get(appId, `/analytics/sessions/${sessionId}/timeline`);
    }
    
    // =========================================================================
    // Searches Endpoints
    // =========================================================================
    
    /**
     * List searches with pagination and filters for a specific app
     * @param {string} appId - PFS app identifier
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Paginated searches list
     */
    async listSearches(appId, params = {}) {
        return apiService.get(appId, '/analytics/searches', {
            limit: params.limit || 50,
            offset: params.offset || 0,
            session_id: params.sessionId,
            client_id: params.clientId,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            query_contains: params.queryContains,
            min_results: params.minResults,
            max_results: params.maxResults
        });
    }
    
    // =========================================================================
    // Conversations Endpoints
    // =========================================================================
    
    /**
     * List conversations with pagination and filters for a specific app
     * @param {string} appId - PFS app identifier
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Paginated conversations list
     */
    async listConversations(appId, params = {}) {
        return apiService.get(appId, '/analytics/conversations', {
            limit: params.limit || 50,
            offset: params.offset || 0,
            session_id: params.sessionId,
            client_id: params.clientId,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            rating_min: params.ratingMin,
            rating_max: params.ratingMax,
            has_rating: params.hasRating,
            has_comment: params.hasComment,
            question_contains: params.questionContains
        });
    }
    
    // =========================================================================
    // Card Config Endpoint
    // =========================================================================
    
    /**
     * Get card configuration for metadata display
     * @param {string} appId - PFS app identifier
     * @returns {Promise<Array>} Card field configuration
     */
    async getCardConfig(appId) {
        // Card config is at /frontend/card-config, not /tracking/...
        const baseUrl = config.getApiBaseUrl(appId).replace('/tracking', '');
        const url = `${baseUrl}/frontend/card-config`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Failed to load card config for ${appId}`);
                return [];
            }
            return await response.json();
        } catch (error) {
            console.warn(`Error loading card config for ${appId}:`, error);
            return [];
        }
    }
}

export const analyticsService = new AnalyticsService();
