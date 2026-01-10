/**
 * Toast.js
 * 
 * Toast notification component for displaying
 * success, error, warning, and info messages.
 */

import { config } from '../core/Config.js';
import { eventBus, Events } from '../core/EventBus.js';

class Toast {
    constructor() {
        this._container = null;
        this._toasts = new Map();
        this._idCounter = 0;
    }

    /**
     * Initialize the toast system
     */
    initialize() {
        this._container = document.getElementById('toast-container');
        
        // Listen for toast events
        eventBus.on(Events.TOAST_SHOW, ({ type, title, message }) => {
            this.show(type, title, message);
        });
        
        console.log('[Toast] Initialized');
    }

    /**
     * Show a toast notification
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @returns {number} Toast ID
     */
    show(type, title, message) {
        const id = ++this._idCounter;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.dataset.toastId = id;
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;

        // Add close handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismiss(id);
        });

        this._container.appendChild(toast);
        this._toasts.set(id, toast);

        // Auto-dismiss after duration
        setTimeout(() => {
            this.dismiss(id);
        }, config.settings.toastDuration);

        return id;
    }

    /**
     * Dismiss a toast
     * @param {number} id - Toast ID
     */
    dismiss(id) {
        const toast = this._toasts.get(id);
        if (toast) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                toast.remove();
                this._toasts.delete(id);
            }, 300);
        }
    }

    /**
     * Show success toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    success(title, message = '') {
        return this.show('success', title, message);
    }

    /**
     * Show error toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    error(title, message = '') {
        return this.show('error', title, message);
    }

    /**
     * Show warning toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    warning(title, message = '') {
        return this.show('warning', title, message);
    }

    /**
     * Show info toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    info(title, message = '') {
        return this.show('info', title, message);
    }
}

export const toast = new Toast();
