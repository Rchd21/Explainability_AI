/**
 * Toast.js
 * 
 * Toast notification component for displaying feedback messages.
 */

import { eventBus, Events } from '../core/index.js';

class Toast {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        this._defaultDuration = 4000;
    }
    
    /**
     * Initialize toast component
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('toast-container');
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        eventBus.on(Events.TOAST_SHOW, (options) => this.show(options));
        
        // Show toast on errors
        eventBus.on(Events.DATA_ERROR, ({ error }) => {
            this.error(`Error: ${error}`);
        });
    }
    
    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     */
    show(options = {}) {
        const {
            message = '',
            type = 'info',
            duration = this._defaultDuration
        } = options;
        
        if (!this._container || !message) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this._getIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        this._container.appendChild(toast);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this._remove(toast);
            }, duration);
        }
        
        return toast;
    }
    
    /**
     * Show success toast
     * @param {string} message - Message to display
     */
    success(message) {
        return this.show({ message, type: 'success' });
    }
    
    /**
     * Show error toast
     * @param {string} message - Message to display
     */
    error(message) {
        return this.show({ message, type: 'error', duration: 6000 });
    }
    
    /**
     * Show info toast
     * @param {string} message - Message to display
     */
    info(message) {
        return this.show({ message, type: 'info' });
    }
    
    /**
     * Show warning toast
     * @param {string} message - Message to display
     */
    warning(message) {
        return this.show({ message, type: 'warning' });
    }
    
    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} Icon character
     */
    _getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Remove a toast element
     * @param {HTMLElement} toast - Toast element
     */
    _remove(toast) {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
    
    /**
     * Clear all toasts
     */
    clear() {
        if (this._container) {
            this._container.innerHTML = '';
        }
    }
}

export const toast = new Toast();
