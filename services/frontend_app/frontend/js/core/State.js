/**
 * State.js
 * 
 * Global application state management.
 * Centralizes state and notifies components of changes via EventBus.
 * Supports multiple PFS applications.
 */

import { eventBus, Events } from './EventBus.js';
import { config } from './Config.js';

class State {
    constructor() {
        // Current app tab (app ID or 'cross-app')
        this._currentAppTab = null;
        
        // Current view within app
        this._currentView = 'dashboard';
        
        // Time period in days
        this._period = config.defaultPeriod;
        
        // Date range filters
        this._dateRange = {
            from: null,
            to: null
        };
        
        // Per-app pagination states
        // Structure: { appId: { viewName: { offset, limit, total } } }
        this._pagination = {};
        
        // Per-app filter states
        // Structure: { appId: { viewName: { filters } } }
        this._filters = {};
        
        // Selected items
        this._selectedClient = null;
        this._selectedSession = null;
        this._selectedConversation = null;
        
        // Theme
        this._theme = this._loadTheme();
        
        // Auto-refresh
        this._refreshInterval = 0;
        this._refreshTimer = null;
        
        // Last update timestamp
        this._lastUpdate = null;
        
        // Loading states
        this._loading = new Set();
        
        // Initialize state for all apps
        this._initializeAppsState();
    }
    
    /**
     * Initialize state structure for all configured apps
     */
    _initializeAppsState() {
        const apps = config.pfsApps;
        const views = ['clients', 'sessions', 'searches', 'conversations'];
        
        apps.forEach(app => {
            this._pagination[app.id] = {};
            this._filters[app.id] = {};
            
            views.forEach(view => {
                this._pagination[app.id][view] = {
                    offset: 0,
                    limit: config.defaultPageSize,
                    total: 0
                };
                this._filters[app.id][view] = {};
            });
            
            // Add feedback filters
            this._filters[app.id]['feedback'] = {};
        });
        
        // Initialize cross-app state
        this._pagination['cross-app'] = {
            clients: { offset: 0, limit: config.defaultPageSize, total: 0 }
        };
        this._filters['cross-app'] = {
            clients: {}
        };
        
        // Set first app as default if available
        if (apps.length > 0) {
            this._currentAppTab = apps[0].id;
        }
    }
    
    // =========================================================================
    // App Tab
    // =========================================================================
    
    get currentAppTab() {
        return this._currentAppTab;
    }
    
    setAppTab(appId) {
        if (this._currentAppTab !== appId) {
            this._currentAppTab = appId;
            eventBus.emit(Events.APP_TAB_CHANGED, { appId });
        }
    }
    
    // =========================================================================
    // View
    // =========================================================================
    
    get currentView() {
        return this._currentView;
    }
    
    setView(view) {
        if (this._currentView !== view) {
            this._currentView = view;
            eventBus.emit(Events.VIEW_CHANGED, { view, appId: this._currentAppTab });
        }
    }
    
    // =========================================================================
    // Period
    // =========================================================================
    
    get period() {
        return this._period;
    }
    
    setPeriod(days) {
        if (this._period !== days) {
            this._period = days;
            eventBus.emit(Events.PERIOD_CHANGED, { days });
        }
    }
    
    // =========================================================================
    // Date Range
    // =========================================================================
    
    get dateRange() {
        return { ...this._dateRange };
    }
    
    setDateRange(from, to) {
        this._dateRange = { from, to };
        eventBus.emit(Events.FILTERS_CHANGED, { 
            appId: this._currentAppTab,
            view: this._currentView, 
            filters: { dateRange: this._dateRange }
        });
    }
    
    clearDateRange() {
        this._dateRange = { from: null, to: null };
    }
    
    // =========================================================================
    // Pagination (Per-App)
    // =========================================================================
    
    getPagination(appId, view) {
        const appPagination = this._pagination[appId];
        if (!appPagination || !appPagination[view]) {
            return { offset: 0, limit: config.defaultPageSize, total: 0 };
        }
        return { ...appPagination[view] };
    }
    
    setPagination(appId, view, { offset, limit, total }) {
        if (!this._pagination[appId]) {
            this._pagination[appId] = {};
        }
        if (!this._pagination[appId][view]) {
            this._pagination[appId][view] = { offset: 0, limit: config.defaultPageSize, total: 0 };
        }
        
        this._pagination[appId][view] = {
            offset: offset ?? this._pagination[appId][view].offset,
            limit: limit ?? this._pagination[appId][view].limit,
            total: total ?? this._pagination[appId][view].total
        };
    }
    
    resetPagination(appId, view) {
        if (this._pagination[appId] && this._pagination[appId][view]) {
            this._pagination[appId][view] = {
                offset: 0,
                limit: config.defaultPageSize,
                total: 0
            };
        }
    }
    
    getCurrentPage(appId, view) {
        const { offset, limit } = this.getPagination(appId, view);
        return Math.floor(offset / limit) + 1;
    }
    
    getTotalPages(appId, view) {
        const { limit, total } = this.getPagination(appId, view);
        return Math.ceil(total / limit);
    }
    
    // =========================================================================
    // Filters (Per-App)
    // =========================================================================
    
    getFilters(appId, view) {
        const appFilters = this._filters[appId];
        if (!appFilters || !appFilters[view]) {
            return {};
        }
        return { ...appFilters[view] };
    }
    
    setFilters(appId, view, filters) {
        if (!this._filters[appId]) {
            this._filters[appId] = {};
        }
        if (!this._filters[appId][view]) {
            this._filters[appId][view] = {};
        }
        
        this._filters[appId][view] = { ...this._filters[appId][view], ...filters };
        eventBus.emit(Events.FILTERS_CHANGED, { appId, view, filters: this._filters[appId][view] });
    }
    
    clearFilters(appId, view) {
        if (this._filters[appId]) {
            this._filters[appId][view] = {};
        }
        this.resetPagination(appId, view);
        eventBus.emit(Events.FILTERS_RESET, { appId, view });
    }
    
    // =========================================================================
    // Selections
    // =========================================================================
    
    get selectedClient() {
        return this._selectedClient;
    }
    
    selectClient(clientId, appId = null) {
        this._selectedClient = { id: clientId, appId };
        eventBus.emit(Events.CLIENT_SELECTED, { clientId, appId });
    }
    
    clearSelectedClient() {
        this._selectedClient = null;
    }
    
    get selectedSession() {
        return this._selectedSession;
    }
    
    selectSession(sessionId, appId = null) {
        this._selectedSession = { id: sessionId, appId };
        eventBus.emit(Events.SESSION_SELECTED, { sessionId, appId });
    }
    
    clearSelectedSession() {
        this._selectedSession = null;
    }
    
    get selectedConversation() {
        return this._selectedConversation;
    }
    
    selectConversation(conversationId, appId = null) {
        this._selectedConversation = { id: conversationId, appId };
        eventBus.emit(Events.CONVERSATION_SELECTED, { conversationId, appId });
    }
    
    clearSelectedConversation() {
        this._selectedConversation = null;
    }
    
    // =========================================================================
    // Theme
    // =========================================================================
    
    get theme() {
        return this._theme;
    }
    
    setTheme(theme) {
        this._theme = theme;
        this._saveTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
        eventBus.emit(Events.THEME_CHANGED, { theme });
    }
    
    toggleTheme() {
        const newTheme = this._theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
    
    _loadTheme() {
        const saved = localStorage.getItem('analytics-theme');
        if (saved) return saved;
        
        // Check system preference
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        
        return 'dark';
    }
    
    _saveTheme(theme) {
        localStorage.setItem('analytics-theme', theme);
    }
    
    // =========================================================================
    // Auto-refresh
    // =========================================================================
    
    get refreshInterval() {
        return this._refreshInterval;
    }
    
    setRefreshInterval(interval) {
        this._refreshInterval = interval;
        this._setupRefreshTimer();
    }
    
    _setupRefreshTimer() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
        
        if (this._refreshInterval > 0) {
            this._refreshTimer = setInterval(() => {
                eventBus.emit(Events.REFRESH_TRIGGERED);
            }, this._refreshInterval);
        }
    }
    
    // =========================================================================
    // Last Update
    // =========================================================================
    
    get lastUpdate() {
        return this._lastUpdate;
    }
    
    setLastUpdate(timestamp = new Date()) {
        this._lastUpdate = timestamp;
    }
    
    // =========================================================================
    // Loading States
    // =========================================================================
    
    isLoading(source) {
        if (source) {
            return this._loading.has(source);
        }
        return this._loading.size > 0;
    }
    
    setLoading(source, loading) {
        if (loading) {
            this._loading.add(source);
            eventBus.emit(Events.DATA_LOADING, { source });
        } else {
            this._loading.delete(source);
            if (this._loading.size === 0) {
                eventBus.emit(Events.DATA_LOADED, { source });
            }
        }
    }
    
    clearLoading() {
        this._loading.clear();
    }
}

export const state = new State();
