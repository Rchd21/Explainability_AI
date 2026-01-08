/**
 * Config.js
 * 
 * Application configuration settings.
 * Contains API URLs, PFS apps list, default values, and other configurable options.
 */

class Config {
    constructor() {
        // =======================================================================
        // PFS APPS CONFIGURATION - MODIFY THIS LIST TO ADD/REMOVE APPS
        // =======================================================================
        this._pfsApps = [
            { id: 'pfs_explorer_numerique', name: 'PFS Numérique', color: '#6366f1' },
            { id: 'pfs_explorer_transports_et_mobilite', name: 'PFS Transports & Mobilité', color: '#22d3ee' },
            { id: 'pfs_explorer_evaluation_et_apprentissage', name: 'PFS Evaluation et Apprentissage', color: '#a855f7' },
        ];
        
        // API Base URL pattern: /pfs/{app_id}/tracking
        this._apiBasePattern = '/pfs/{app_id}/tracking';
        
        // Default pagination
        this._defaultPageSize = 50;
        this._maxPageSize = 200;
        
        // Default time period in days
        this._defaultPeriod = 30;
        
        // Auto-refresh intervals (in milliseconds)
        this._refreshIntervals = {
            off: 0,
            fast: 30000,    // 30 seconds
            normal: 60000,  // 1 minute
            slow: 300000    // 5 minutes
        };
        
        // Chart colors palette for multiple apps
        this._appColors = [
            '#6366f1',  // Indigo
            '#22d3ee',  // Cyan
            '#a855f7',  // Purple
            '#22c55e',  // Green
            '#f59e0b',  // Amber
            '#ef4444',  // Red
            '#ec4899',  // Pink
            '#14b8a6',  // Teal
            '#f97316',  // Orange
            '#8b5cf6',  // Violet
        ];
        
        // Chart colors
        this._chartColors = {
            primary: '#6366f1',
            secondary: '#22d3ee',
            tertiary: '#a855f7',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#ef4444',
            sessions: '#6366f1',
            searches: '#22d3ee',
            conversations: '#a855f7',
            newClients: '#22c55e'
        };
        
        // Rating colors for stars
        this._ratingColors = {
            1: '#ef4444',
            2: '#f59e0b',
            3: '#f59e0b',
            4: '#22c55e',
            5: '#22c55e'
        };
        
        // Date format options
        this._dateFormatOptions = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            medium: { day: '2-digit', month: 'short', year: 'numeric' },
            long: { day: '2-digit', month: 'long', year: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            full: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        
        // Locale for formatting
        this._locale = 'en-US';
    }
    
    // =========================================================================
    // PFS Apps Getters
    // =========================================================================
    
    get pfsApps() {
        return this._pfsApps;
    }
    
    get appColors() {
        return this._appColors;
    }
    
    /**
     * Get API base URL for a specific PFS app
     * @param {string} appId - PFS app identifier
     * @returns {string} API base URL
     */
    getApiBaseUrl(appId) {
        return this._apiBasePattern.replace('{app_id}', appId);
    }
    
    /**
     * Get app configuration by ID
     * @param {string} appId - PFS app identifier
     * @returns {Object|null} App configuration
     */
    getAppById(appId) {
        return this._pfsApps.find(app => app.id === appId) || null;
    }
    
    /**
     * Get color for an app by index
     * @param {number} index - App index
     * @returns {string} Color hex code
     */
    getAppColor(index) {
        return this._appColors[index % this._appColors.length];
    }
    
    /**
     * Set PFS apps configuration
     * @param {Array} apps - Array of app configurations
     */
    setPfsApps(apps) {
        this._pfsApps = apps.map((app, index) => ({
            ...app,
            color: app.color || this.getAppColor(index)
        }));
    }
    
    // =========================================================================
    // Standard Getters
    // =========================================================================
    
    get defaultPageSize() {
        return this._defaultPageSize;
    }
    
    get maxPageSize() {
        return this._maxPageSize;
    }
    
    get defaultPeriod() {
        return this._defaultPeriod;
    }
    
    get refreshIntervals() {
        return this._refreshIntervals;
    }
    
    get chartColors() {
        return this._chartColors;
    }
    
    get ratingColors() {
        return this._ratingColors;
    }
    
    get dateFormatOptions() {
        return this._dateFormatOptions;
    }
    
    get locale() {
        return this._locale;
    }
    
    // Setters
    setApiBasePattern(pattern) {
        this._apiBasePattern = pattern;
    }
    
    setLocale(locale) {
        this._locale = locale;
    }
}

export const config = new Config();
