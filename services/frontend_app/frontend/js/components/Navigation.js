/**
 * Navigation.js
 * 
 * Handles navigation between views and mobile menu toggle.
 */

import { eventBus, Events, state } from '../core/index.js';

class Navigation {
    constructor() {
        this._navMenu = null;
        this._sidebar = null;
        this._mobileToggle = null;
        this._pageTitle = null;
        this._isInitialized = false;
        
        this._viewTitles = {
            dashboard: 'Dashboard',
            clients: 'Clients',
            sessions: 'Sessions',
            searches: 'Searches',
            conversations: 'Conversations',
            feedback: 'Feedback'
        };
    }
    
    /**
     * Initialize navigation component
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._navMenu = document.getElementById('nav-menu');
        this._sidebar = document.getElementById('sidebar');
        this._mobileToggle = document.getElementById('mobile-menu-toggle');
        this._pageTitle = document.getElementById('page-title');
        
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Navigation item clicks
        if (this._navMenu) {
            this._navMenu.addEventListener('click', (e) => {
                const navItem = e.target.closest('.nav-item');
                if (navItem) {
                    const view = navItem.dataset.view;
                    this.navigateTo(view);
                }
            });
        }
        
        // Mobile menu toggle
        if (this._mobileToggle) {
            this._mobileToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
        
        // Close mobile menu on overlay click
        document.addEventListener('click', (e) => {
            if (this._sidebar?.classList.contains('open')) {
                if (!this._sidebar.contains(e.target) && !this._mobileToggle?.contains(e.target)) {
                    this.closeMobileMenu();
                }
            }
        });
        
        // Listen for view changes
        eventBus.on(Events.VIEW_CHANGED, ({ view }) => {
            this._updateActiveItem(view);
            this._updatePageTitle(view);
            this.closeMobileMenu();
        });
    }
    
    /**
     * Navigate to a view
     * @param {string} view - View name
     */
    navigateTo(view) {
        if (view && view !== state.currentView) {
            state.setView(view);
        }
    }
    
    /**
     * Update active navigation item
     * @param {string} view - Active view name
     */
    _updateActiveItem(view) {
        if (!this._navMenu) return;
        
        // Remove active class from all items
        this._navMenu.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current item
        const activeItem = this._navMenu.querySelector(`[data-view="${view}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
    
    /**
     * Update page title
     * @param {string} view - Active view name
     */
    _updatePageTitle(view) {
        if (this._pageTitle) {
            this._pageTitle.textContent = this._viewTitles[view] || view;
        }
    }
    
    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        if (this._sidebar) {
            this._sidebar.classList.toggle('open');
        }
    }
    
    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        if (this._sidebar) {
            this._sidebar.classList.remove('open');
        }
    }
    
    /**
     * Open mobile menu
     */
    openMobileMenu() {
        if (this._sidebar) {
            this._sidebar.classList.add('open');
        }
    }
}

export const navigation = new Navigation();
