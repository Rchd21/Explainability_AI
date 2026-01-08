/**
 * Modal.js
 * 
 * Generic modal component for displaying detailed information.
 * Supports different sizes and dynamic content.
 */

import { eventBus, Events } from '../core/index.js';

class Modal {
    constructor() {
        this._overlay = null;
        this._modal = null;
        this._title = null;
        this._body = null;
        this._closeBtn = null;
        this._isInitialized = false;
        this._isOpen = false;
        this._onCloseCallback = null;
    }
    
    /**
     * Initialize modal component
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._overlay = document.getElementById('modal-overlay');
        this._modal = document.getElementById('modal');
        this._title = document.getElementById('modal-title');
        this._body = document.getElementById('modal-body');
        this._closeBtn = document.getElementById('modal-close');
        
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Close button
        if (this._closeBtn) {
            this._closeBtn.addEventListener('click', () => this.close());
        }
        
        // Overlay click
        if (this._overlay) {
            this._overlay.addEventListener('click', (e) => {
                if (e.target === this._overlay) {
                    this.close();
                }
            });
        }
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) {
                this.close();
            }
        });
        
        // Listen for modal events
        eventBus.on(Events.MODAL_OPEN, (options) => this.open(options));
        eventBus.on(Events.MODAL_CLOSE, () => this.close());
    }
    
    /**
     * Open the modal
     * @param {Object} options - Modal options
     */
    open(options = {}) {
        const {
            title = '',
            content = '',
            size = 'medium',
            onClose = null
        } = options;
        
        // Set title
        if (this._title) {
            this._title.textContent = title;
        }
        
        // Set content
        if (this._body) {
            if (typeof content === 'string') {
                this._body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                this._body.innerHTML = '';
                this._body.appendChild(content);
            }
        }
        
        // Set size
        if (this._modal) {
            this._modal.classList.remove('modal-small', 'modal-medium', 'modal-large', 'modal-fullscreen');
            if (size !== 'medium') {
                this._modal.classList.add(`modal-${size}`);
            }
        }
        
        // Store callback
        this._onCloseCallback = onClose;
        
        // Show modal
        if (this._overlay) {
            this._overlay.classList.add('active');
        }
        
        this._isOpen = true;
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Close the modal
     */
    close() {
        if (this._overlay) {
            this._overlay.classList.remove('active');
        }
        
        this._isOpen = false;
        document.body.style.overflow = '';
        
        // Execute callback
        if (this._onCloseCallback) {
            this._onCloseCallback();
            this._onCloseCallback = null;
        }
        
        // Clear content after animation
        setTimeout(() => {
            if (this._body) {
                this._body.innerHTML = '';
            }
        }, 300);
    }
    
    /**
     * Check if modal is open
     * @returns {boolean} Modal open state
     */
    isOpen() {
        return this._isOpen;
    }
    
    /**
     * Set modal title
     * @param {string} title - Modal title
     */
    setTitle(title) {
        if (this._title) {
            this._title.textContent = title;
        }
    }
    
    /**
     * Set modal content
     * @param {string|HTMLElement} content - Modal content
     */
    setContent(content) {
        if (this._body) {
            if (typeof content === 'string') {
                this._body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                this._body.innerHTML = '';
                this._body.appendChild(content);
            }
        }
    }
    
    /**
     * Append content to modal body
     * @param {string|HTMLElement} content - Content to append
     */
    appendContent(content) {
        if (this._body) {
            if (typeof content === 'string') {
                this._body.insertAdjacentHTML('beforeend', content);
            } else if (content instanceof HTMLElement) {
                this._body.appendChild(content);
            }
        }
    }
}

export const modal = new Modal();
