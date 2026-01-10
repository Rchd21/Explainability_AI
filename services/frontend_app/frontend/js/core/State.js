/**
 * State.js
 * 
 * Centralized application state management.
 * Handles theme, current detector, and other global state.
 */

import { eventBus, Events } from './EventBus.js';

class State {
    constructor() {
        // Current active detector tab
        this._currentDetector = 'lung-cancer';
        
        // Theme (dark/light)
        this._theme = this._loadTheme();
        
        // Loading states
        this._loading = {
            lungCancer: false,
            audioFake: false
        };
    }

    /**
     * Load theme from localStorage or use default
     * @returns {string} Theme name
     */
    _loadTheme() {
        const stored = localStorage.getItem('ai-detection-theme');
        if (stored) {
            return stored;
        }
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    get theme() {
        return this._theme;
    }

    /**
     * Set theme
     * @param {string} theme - Theme name ('dark' or 'light')
     */
    setTheme(theme) {
        this._theme = theme;
        localStorage.setItem('ai-detection-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        eventBus.emit(Events.THEME_CHANGED, { theme });
    }

    /**
     * Toggle between dark and light theme
     */
    toggleTheme() {
        const newTheme = this._theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    /**
     * Get current detector
     * @returns {string} Current detector ID
     */
    get currentDetector() {
        return this._currentDetector;
    }

    /**
     * Set current detector
     * @param {string} detectorId - Detector ID
     */
    setDetector(detectorId) {
        if (this._currentDetector !== detectorId) {
            this._currentDetector = detectorId;
            eventBus.emit(Events.DETECTOR_CHANGED, { detector: detectorId });
        }
    }

    /**
     * Get loading state for a detector
     * @param {string} detector - Detector key
     * @returns {boolean} Loading state
     */
    isLoading(detector) {
        return this._loading[detector] || false;
    }

    /**
     * Set loading state for a detector
     * @param {string} detector - Detector key
     * @param {boolean} loading - Loading state
     */
    setLoading(detector, loading) {
        this._loading[detector] = loading;
    }
}

export const state = new State();
