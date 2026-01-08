/**
 * Loader.js
 * 
 * Loading indicator component.
 * Manages global and inline loading states.
 */

import { eventBus, Events } from '../core/index.js';

class Loader {
    constructor() {
        this._globalLoader = null;
        this._isInitialized = false;
    }
    
    /**
     * Initialize the loader component
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._globalLoader = document.getElementById('global-loader');
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Listen for loading events
        eventBus.on(Events.DATA_LOADING, ({ source }) => {
            // Only show global loader for initial dashboard load
            if (source === 'app') {
                this.showGlobal();
            }
        });
        
        eventBus.on(Events.DATA_LOADED, () => {
            this.hideGlobal();
        });
    }
    
    /**
     * Show the global loader
     */
    showGlobal() {
        if (this._globalLoader) {
            this._globalLoader.classList.add('active');
        }
    }
    
    /**
     * Hide the global loader
     */
    hideGlobal() {
        if (this._globalLoader) {
            this._globalLoader.classList.remove('active');
        }
    }
    
    /**
     * Create an inline loader element
     * @param {string} size - Loader size ('small', 'medium', 'large')
     * @returns {HTMLElement} Loader element
     */
    createInline(size = 'medium') {
        const loader = document.createElement('div');
        loader.className = 'loader-inline';
        loader.innerHTML = `<div class="loader-spinner"></div>`;
        
        return loader;
    }
    
    /**
     * Show loader in a container
     * @param {HTMLElement|string} container - Container element or ID
     */
    showInContainer(container) {
        const element = typeof container === 'string' 
            ? document.getElementById(container) 
            : container;
        
        if (element) {
            element.innerHTML = '';
            element.appendChild(this.createInline());
        }
    }
    
    /**
     * Create loading state for a table
     * @param {number} columns - Number of table columns
     * @returns {string} HTML string for table loading
     */
    createTableLoading(columns) {
        return `
            <tr>
                <td colspan="${columns}" class="table-loading">
                    <div class="loader-spinner"></div>
                </td>
            </tr>
        `;
    }
}

export const loader = new Loader();
