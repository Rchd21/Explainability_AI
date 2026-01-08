/**
 * app.js
 * 
 * Main application entry point for multi-PFS analytics dashboard.
 * Initializes all components, creates app tabs, and manages navigation.
 */

import { config, eventBus, Events, state } from './core/index.js';
import { loader, navigation, modal, toast } from './components/index.js';
import { crossAppView } from './views/index.js';
import { AppViewManager } from './views/AppViewManager.js';

/**
 * Main Application Class
 */
class App {
    constructor() {
        this._isInitialized = false;
        this._appManagers = new Map();
    }
    
    async initialize() {
        if (this._isInitialized) return;
        
        console.log('[App] Initializing Multi-App Analytics Dashboard...');
        
        this._initializeTheme();
        this._initializeComponents();
        this._createAppTabs();
        this._createAppViewManagers();
        crossAppView.initialize();
        this._setupEventHandlers();
        this._setupPeriodSelector();
        this._setupRefreshControls();
        
        this._isInitialized = true;
        await this._loadInitialApp();
        
        console.log('[App] Initialization complete');
    }
    
    _initializeTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
        document.getElementById('theme-toggle')?.addEventListener('click', () => state.toggleTheme());
    }
    
    _initializeComponents() {
        loader.initialize();
        navigation.initialize();
        modal.initialize();
        toast.initialize();
    }
    
    _createAppTabs() {
        const container = document.getElementById('app-tabs-container');
        if (!container) return;
        
        const apps = config.pfsApps;
        let tabsHtml = apps.map(app => `
            <button class="app-tab" data-app-id="${app.id}">
                <span class="app-tab-dot" style="background: ${app.color}"></span>
                <span>${app.name}</span>
            </button>
        `).join('');
        
        tabsHtml += `<button class="app-tab app-tab-cross" data-app-id="cross-app"><span>⬡</span><span>Cross-App</span></button>`;
        container.innerHTML = tabsHtml;
        
        container.querySelectorAll('.app-tab').forEach(tab => {
            tab.addEventListener('click', () => state.setAppTab(tab.dataset.appId));
        });
    }
    
    _createAppViewManagers() {
        config.pfsApps.forEach(app => {
            const manager = new AppViewManager(app);
            manager.initialize();
            this._appManagers.set(app.id, manager);
        });
    }
    
    _setupEventHandlers() {
        eventBus.on(Events.APP_TAB_CHANGED, ({ appId }) => this._switchAppTab(appId));
        eventBus.on(Events.VIEW_CHANGED, ({ view }) => this._switchView(view));
        eventBus.on(Events.PERIOD_CHANGED, () => this._reloadCurrentView());
        eventBus.on(Events.REFRESH_TRIGGERED, () => this._reloadCurrentView());
        eventBus.on(Events.THEME_CHANGED, () => this._appManagers.forEach(m => m.refreshCharts()));
        eventBus.on(Events.DATA_LOADED, () => this._updateLastUpdate());
        
        document.getElementById('nav-menu')?.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) state.setView(navItem.dataset.view);
        });
    }
    
    _setupPeriodSelector() {
        const selector = document.getElementById('period-selector');
        if (!selector) return;
        
        selector.addEventListener('click', (e) => {
            const btn = e.target.closest('.period-btn');
            if (!btn) return;
            selector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.setPeriod(parseInt(btn.dataset.days, 10));
        });
    }
    
    _setupRefreshControls() {
        const refreshSelect = document.getElementById('refresh-interval');
        if (!refreshSelect) return;
        
        refreshSelect.addEventListener('change', () => {
            const interval = parseInt(refreshSelect.value, 10);
            state.setRefreshInterval(interval);
            toast.info(interval > 0 ? `Auto-refresh: every ${interval / 1000}s` : 'Auto-refresh disabled');
        });
    }
    
    async _loadInitialApp() {
        state.setLoading('app', true);
        if (config.pfsApps.length > 0) state.setAppTab(config.pfsApps[0].id);
        state.setLoading('app', false);
    }
    
    async _switchAppTab(appId) {
        document.querySelectorAll('.app-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.appId === appId);
        });
        
        this._updateCurrentAppBadge(appId);
        this._appManagers.forEach(m => m.hide());
        document.getElementById('cross-app-view')?.classList.remove('active');
        
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) navMenu.style.display = appId === 'cross-app' ? 'none' : 'flex';
        
        if (appId === 'cross-app') {
            document.getElementById('cross-app-view')?.classList.add('active');
            document.getElementById('page-title').textContent = 'Cross-App Analytics';
            await crossAppView.load();
        } else {
            const manager = this._appManagers.get(appId);
            if (manager) {
                manager.show();
                manager.switchView(state.currentView);
                await manager.loadView(state.currentView);
                this._updateNavActive(state.currentView);
                this._updatePageTitle(state.currentView);
            }
        }
        state.setLastUpdate();
    }
    
    async _switchView(viewName) {
        if (state.currentAppTab === 'cross-app') return;
        const manager = this._appManagers.get(state.currentAppTab);
        if (manager) {
            manager.switchView(viewName);
            await manager.loadView(viewName);
        }
        this._updateNavActive(viewName);
        this._updatePageTitle(viewName);
    }
    
    async _reloadCurrentView() {
        const appId = state.currentAppTab;
        if (appId === 'cross-app') {
            await crossAppView.load();
        } else {
            const manager = this._appManagers.get(appId);
            if (manager) await manager.loadView(state.currentView);
        }
    }
    
    _updateCurrentAppBadge(appId) {
        const badge = document.getElementById('current-app-badge');
        if (!badge) return;
        if (appId === 'cross-app') {
            badge.innerHTML = `<span>All Applications</span>`;
        } else {
            const app = config.getAppById(appId);
            if (app) badge.innerHTML = `<span class="app-color-dot" style="background: ${app.color}"></span><span>${app.name}</span>`;
        }
    }
    
    _updateNavActive(viewName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
    }
    
    _updatePageTitle(viewName) {
        const titles = { dashboard: 'Dashboard', clients: 'Clients', sessions: 'Sessions', searches: 'Searches', conversations: 'Conversations', feedback: 'Feedback' };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = titles[viewName] || viewName;
    }
    
    _updateLastUpdate() {
        const element = document.getElementById('last-update');
        if (!element) return;
        const now = new Date();
        const time = now.toLocaleTimeString(config.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const textEl = element.querySelector('.update-text');
        if (textEl) textEl.textContent = time;
        state.setLastUpdate(now);
    }
}

// Bootstrap
const app = new App();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

window.analyticsApp = app;
window.analyticsState = state;
