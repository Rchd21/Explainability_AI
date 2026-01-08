/**
 * AppViewManager.js
 * 
 * Manages dynamic creation and switching of views for multiple PFS applications.
 * Creates separate view instances for each configured app.
 */

import { config, eventBus, Events, state } from '../core/index.js';
import { analyticsService } from '../services/index.js';
import { 
    createActivityChart, 
    createRatingChart, 
    createHourlyChart, 
    createQueriesChart,
    DataTable,
    Pagination,
    formatDate,
    formatDuration,
    truncateId,
    truncateText,
    renderStars,
    renderBadge,
    renderConversationDetail,
    renderSearchDetail,
    renderEnhancedTimeline,
    renderContextDocumentOverlay
} from '../components/index.js';
import { exportService } from '../services/index.js';

/**
 * AppViewManager - Creates and manages views for a single PFS application
 */
class AppViewManager {
    constructor(appConfig) {
        this._app = appConfig;
        this._containerId = `app-${appConfig.id}`;
        this._container = null;
        this._isInitialized = false;
        
        // View elements
        this._views = {};
        
        // Charts
        this._charts = {};
        
        // Data tables
        this._tables = {};
        
        // Pagination
        this._paginations = {};
        
        // Cached data
        this._data = {};
        
        // Card configuration for metadata display
        this._cardConfig = [];
    }
    
    get appId() {
        return this._app.id;
    }
    
    get appName() {
        return this._app.name;
    }
    
    get appColor() {
        return this._app.color;
    }
    
    /**
     * Initialize the app views
     */
    initialize() {
        if (this._isInitialized) return;
        
        // Register this manager for global click handling
        this._registerManager();
        
        this._createContainer();
        this._getViewsHTML();
        this._initializeCharts();
        this._initializeTables();
        this._setupEventListeners();
        
        // Load card configuration (async, non-blocking)
        this._loadCardConfig();
        
        this._isInitialized = true;
    }
    
    /**
     * Load card configuration for metadata display
     */
    async _loadCardConfig() {
        try {
            this._cardConfig = await analyticsService.getCardConfig(this._app.id);
        } catch (error) {
            console.warn(`Failed to load card config for ${this._app.id}:`, error);
            this._cardConfig = [];
        }
    }
    
    /**
     * Create the main container for this app's views
     */
    _createContainer() {
        const appViewsContainer = document.getElementById('app-views-container');
        if (!appViewsContainer) return;
        
        this._container = document.createElement('div');
        this._container.id = this._containerId;
        this._container.className = 'app-view-wrapper';
        
        appViewsContainer.appendChild(this._container);
    }
    
    /**
     * Get HTML template for all views and set up view references
     */
    _getViewsHTML() {
        const id = this._containerId;
        
        this._container.innerHTML = `
            <!-- Dashboard View -->
            <section class="view active" id="${id}-dashboard">
                <div class="kpi-grid" id="${id}-kpi-grid">
                    <div class="kpi-card" data-kpi="clients">
                        <div class="kpi-header">
                            <span class="kpi-icon">◎</span>
                            <span class="kpi-trend" id="${id}-kpi-clients-trend"></span>
                        </div>
                        <div class="kpi-value" id="${id}-kpi-clients-value">--</div>
                        <div class="kpi-label">Total Clients</div>
                        <div class="kpi-sub" id="${id}-kpi-clients-sub">-- new</div>
                    </div>
                    <div class="kpi-card" data-kpi="sessions">
                        <div class="kpi-header">
                            <span class="kpi-icon">◐</span>
                        </div>
                        <div class="kpi-value" id="${id}-kpi-sessions-value">--</div>
                        <div class="kpi-label">Total Sessions</div>
                        <div class="kpi-sub" id="${id}-kpi-sessions-sub">-- min avg</div>
                    </div>
                    <div class="kpi-card" data-kpi="searches">
                        <div class="kpi-header">
                            <span class="kpi-icon">◑</span>
                        </div>
                        <div class="kpi-value" id="${id}-kpi-searches-value">--</div>
                        <div class="kpi-label">Total Searches</div>
                        <div class="kpi-sub" id="${id}-kpi-searches-sub">-- avg results</div>
                    </div>
                    <div class="kpi-card" data-kpi="conversations">
                        <div class="kpi-header">
                            <span class="kpi-icon">◒</span>
                        </div>
                        <div class="kpi-value" id="${id}-kpi-conversations-value">--</div>
                        <div class="kpi-label">Conversations</div>
                        <div class="kpi-sub" id="${id}-kpi-conversations-sub">-- avg rating</div>
                    </div>
                </div>
                <div class="charts-grid">
                    <div class="chart-card chart-large">
                        <div class="chart-header"><h3 class="chart-title">Activity Over Time</h3></div>
                        <div class="chart-body"><canvas id="${id}-activity-chart"></canvas></div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header"><h3 class="chart-title">Rating Distribution</h3></div>
                        <div class="chart-body"><canvas id="${id}-rating-chart"></canvas></div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-header"><h3 class="chart-title">Hourly Activity</h3></div>
                        <div class="chart-body"><canvas id="${id}-hourly-chart"></canvas></div>
                    </div>
                    <div class="chart-card chart-large">
                        <div class="chart-header"><h3 class="chart-title">Top Queries</h3></div>
                        <div class="chart-body"><canvas id="${id}-queries-chart"></canvas></div>
                    </div>
                </div>
                <div class="recent-section">
                    <div class="section-header">
                        <h3 class="section-title">Recent Feedback</h3>
                        <button class="btn-link" id="${id}-view-all-feedback">View all →</button>
                    </div>
                    <div class="feedback-list" id="${id}-recent-feedback"></div>
                </div>
            </section>

            <!-- Clients View -->
            <section class="view" id="${id}-clients">
                <div class="view-header">
                    <div class="filter-bar">
                        <div class="filter-group">
                            <input type="text" class="filter-input" id="${id}-clients-search" placeholder="Search clients...">
                        </div>
                        <div class="filter-group">
                            <input type="date" class="filter-input" id="${id}-clients-date-from">
                            <input type="date" class="filter-input" id="${id}-clients-date-to">
                        </div>
                        <button class="btn btn-secondary" id="${id}-clients-apply">Apply</button>
                        <button class="btn btn-ghost" id="${id}-clients-reset">Reset</button>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary" id="${id}-clients-export">Export</button>
                    </div>
                </div>
                <div class="table-container" id="${id}-clients-table"></div>
                <div class="pagination-container" id="${id}-clients-pagination"></div>
            </section>

            <!-- Sessions View -->
            <section class="view" id="${id}-sessions">
                <div class="view-header">
                    <div class="filter-bar">
                        <div class="filter-group">
                            <input type="text" class="filter-input" id="${id}-sessions-client-id" placeholder="Client ID...">
                        </div>
                        <div class="filter-group">
                            <input type="date" class="filter-input" id="${id}-sessions-date-from">
                            <input type="date" class="filter-input" id="${id}-sessions-date-to">
                        </div>
                        <div class="filter-group">
                            <input type="number" class="filter-input filter-small" id="${id}-sessions-min-duration" placeholder="Min duration">
                        </div>
                        <button class="btn btn-secondary" id="${id}-sessions-apply">Apply</button>
                        <button class="btn btn-ghost" id="${id}-sessions-reset">Reset</button>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary" id="${id}-sessions-export">Export</button>
                    </div>
                </div>
                <div class="table-container" id="${id}-sessions-table"></div>
                <div class="pagination-container" id="${id}-sessions-pagination"></div>
            </section>

            <!-- Searches View -->
            <section class="view" id="${id}-searches">
                <div class="view-header">
                    <div class="filter-bar">
                        <div class="filter-group">
                            <input type="text" class="filter-input" id="${id}-searches-query" placeholder="Query contains...">
                        </div>
                        <div class="filter-group">
                            <input type="date" class="filter-input" id="${id}-searches-date-from">
                            <input type="date" class="filter-input" id="${id}-searches-date-to">
                        </div>
                        <div class="filter-group">
                            <input type="number" class="filter-input filter-small" id="${id}-searches-min-results" placeholder="Min results">
                            <input type="number" class="filter-input filter-small" id="${id}-searches-max-results" placeholder="Max results">
                        </div>
                        <button class="btn btn-secondary" id="${id}-searches-apply">Apply</button>
                        <button class="btn btn-ghost" id="${id}-searches-reset">Reset</button>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary" id="${id}-searches-export">Export</button>
                    </div>
                </div>
                <div class="table-container" id="${id}-searches-table"></div>
                <div class="pagination-container" id="${id}-searches-pagination"></div>
            </section>

            <!-- Conversations View -->
            <section class="view" id="${id}-conversations">
                <div class="view-header">
                    <div class="filter-bar">
                        <div class="filter-group">
                            <input type="text" class="filter-input" id="${id}-conversations-question" placeholder="Question contains...">
                        </div>
                        <div class="filter-group">
                            <input type="date" class="filter-input" id="${id}-conversations-date-from">
                            <input type="date" class="filter-input" id="${id}-conversations-date-to">
                        </div>
                        <div class="filter-group">
                            <select class="filter-select" id="${id}-conversations-has-rating">
                                <option value="">All ratings</option>
                                <option value="true">Has rating</option>
                                <option value="false">No rating</option>
                            </select>
                            <select class="filter-select" id="${id}-conversations-rating-min">
                                <option value="">Min rating</option>
                                <option value="1">1+</option>
                                <option value="2">2+</option>
                                <option value="3">3+</option>
                                <option value="4">4+</option>
                                <option value="5">5</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" id="${id}-conversations-apply">Apply</button>
                        <button class="btn btn-ghost" id="${id}-conversations-reset">Reset</button>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary" id="${id}-conversations-export">Export</button>
                    </div>
                </div>
                <div class="table-container" id="${id}-conversations-table"></div>
                <div class="pagination-container" id="${id}-conversations-pagination"></div>
            </section>

            <!-- Feedback View -->
            <section class="view" id="${id}-feedback">
                <div class="feedback-stats" id="${id}-feedback-stats">
                    <div class="stat-card">
                        <div class="stat-value" id="${id}-feedback-avg-rating">--</div>
                        <div class="stat-label">Average Rating</div>
                        <div class="stat-stars" id="${id}-feedback-avg-stars"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="${id}-feedback-total-rated">--</div>
                        <div class="stat-label">Rated Conversations</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="${id}-feedback-with-comments">--</div>
                        <div class="stat-label">With Comments</div>
                    </div>
                </div>
                <div class="feedback-charts">
                    <div class="chart-card">
                        <div class="chart-header"><h3 class="chart-title">Rating Distribution</h3></div>
                        <div class="chart-body"><canvas id="${id}-feedback-rating-chart"></canvas></div>
                    </div>
                </div>
                <div class="view-header">
                    <div class="filter-bar">
                        <div class="filter-group">
                            <select class="filter-select" id="${id}-feedback-rating-filter">
                                <option value="">All ratings</option>
                                <option value="low">Low (1-2)</option>
                                <option value="medium">Medium (3)</option>
                                <option value="high">High (4-5)</option>
                            </select>
                            <select class="filter-select" id="${id}-feedback-comment-filter">
                                <option value="">All</option>
                                <option value="true">With comment</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="feedback-list feedback-list-full" id="${id}-feedback-list"></div>
            </section>
        `;
        
        // Store references to view elements
        this._views = {
            dashboard: this._container.querySelector(`#${id}-dashboard`),
            clients: this._container.querySelector(`#${id}-clients`),
            sessions: this._container.querySelector(`#${id}-sessions`),
            searches: this._container.querySelector(`#${id}-searches`),
            conversations: this._container.querySelector(`#${id}-conversations`),
            feedback: this._container.querySelector(`#${id}-feedback`)
        };
    }
    
    /**
     * Initialize charts
     */
    _initializeCharts() {
        const id = this._containerId;
        
        this._charts = {
            activity: createActivityChart(`${id}-activity-chart`),
            rating: createRatingChart(`${id}-rating-chart`),
            hourly: createHourlyChart(`${id}-hourly-chart`),
            queries: createQueriesChart(`${id}-queries-chart`),
            feedbackRating: createRatingChart(`${id}-feedback-rating-chart`)
        };
    }
    
    /**
     * Initialize data tables
     */
    _initializeTables() {
        const id = this._containerId;
        const appId = this._app.id;
        
        // Clients table
        this._tables.clients = new DataTable(`${id}-clients-table`, {
            columns: [
                { key: 'id', label: 'ID', width: '100px', render: (val) => `<span class="table-id">${truncateId(val)}</span>` },
                { key: 'platform', label: 'Platform', render: (val) => val || '—' },
                { key: 'language', label: 'Language', render: (val) => val || '—' },
                { key: 'created_at', label: 'Created', render: (val) => formatDate(val, 'medium') },
                { key: 'last_seen', label: 'Last Seen', render: (val) => formatDate(val, 'medium') },
                { key: 'session_count', label: 'Sessions', render: (val) => renderBadge(val || 0, 'primary') },
                { key: 'total_searches', label: 'Searches', render: (val) => val?.toLocaleString() || '0' },
                { key: 'total_conversations', label: 'Conversations', render: (val) => val?.toLocaleString() || '0' }
            ],
            onRowClick: (item) => this._showClientDetail(item),
            emptyMessage: 'No clients found'
        });
        
        this._paginations.clients = new Pagination(`${id}-clients-pagination`, {
            onPageChange: (page, offset) => {
                state.setPagination(appId, 'clients', { offset });
                this.loadClients();
            }
        });
        
        // Sessions table
        this._tables.sessions = new DataTable(`${id}-sessions-table`, {
            columns: [
                { key: 'id', label: 'ID', width: '100px', render: (val) => `<span class="table-id">${truncateId(val)}</span>` },
                { key: 'client_id', label: 'Client', width: '100px', render: (val) => `<span class="table-id">${truncateId(val)}</span>` },
                { key: 'created_at', label: 'Started', render: (val) => formatDate(val, 'full') },
                { key: 'duration_minutes', label: 'Duration', render: (val) => val ? `${val.toFixed(1)} min` : '—' },
                { key: 'ip_address', label: 'IP', render: (val) => val || '—' },
                { key: 'search_count', label: 'Searches', render: (val) => renderBadge(val || 0, 'primary') },
                { key: 'conversation_count', label: 'Conversations', render: (val) => renderBadge(val || 0) }
            ],
            onRowClick: (item) => this._showSessionDetail(item),
            emptyMessage: 'No sessions found'
        });
        
        this._paginations.sessions = new Pagination(`${id}-sessions-pagination`, {
            onPageChange: (page, offset) => {
                state.setPagination(appId, 'sessions', { offset });
                this.loadSessions();
            }
        });
        
        // Searches table
        this._tables.searches = new DataTable(`${id}-searches-table`, {
            columns: [
                { key: 'created_at', label: 'Date', width: '140px', render: (val) => formatDate(val, 'full') },
                { key: 'query', label: 'Query', className: 'table-truncate', render: (val) => val ? `<strong>${this._escapeHtml(truncateText(val, 50))}</strong>` : '<em class="text-muted">Browse mode</em>' },
                { key: 'filters', label: 'Filters', width: '80px', render: (val) => val?.length ? renderBadge(`${val.length}`, 'primary') : '—' },
                { key: 'results_count', label: 'Results', width: '80px', render: (val) => val?.toLocaleString() || '0' },
                { key: 'duration_ms', label: 'Duration', width: '80px', render: (val) => formatDuration(val) },
                { key: 'score_threshold', label: 'Threshold', width: '70px', render: (val) => val ? `${(val * 100).toFixed(0)}%` : '—' },
                { key: 'score_strategy', label: 'Strategy', width: '80px', render: (val) => val ? `<span class="strategy-badge ${val}">${val}</span>` : '—' },
                { key: 'session_id', label: 'Session', width: '90px', render: (val) => `<span class="table-id">${truncateId(val)}</span>` }
            ],
            onRowClick: (item) => this._showSearchDetail(item),
            emptyMessage: 'No searches found'
        });
        
        this._paginations.searches = new Pagination(`${id}-searches-pagination`, {
            onPageChange: (page, offset) => {
                state.setPagination(appId, 'searches', { offset });
                this.loadSearches();
            }
        });
        
        // Conversations table with context info
        this._tables.conversations = new DataTable(`${id}-conversations-table`, {
            columns: [
                { key: 'created_at', label: 'Date', width: '140px', render: (val) => formatDate(val, 'full') },
                { key: 'question', label: 'Question', className: 'table-truncate', render: (val) => this._escapeHtml(truncateText(val, 45)) },
                { 
                    key: 'context', 
                    label: 'Context', 
                    width: '120px', 
                    render: (val) => {
                        if (!val || val.length === 0) return '<span class="text-muted">—</span>';
                        const docs = new Set(val.map(c => c.document_id || c.title)).size;
                        return `<span class="context-summary-badge">📚 ${val.length}p (${docs} doc${docs > 1 ? 's' : ''})</span>`;
                    }
                },
                { key: 'response_time_ms', label: 'Time', width: '70px', render: (val) => formatDuration(val) },
                { key: 'model_name', label: 'Model', width: '80px', render: (val) => val ? `<span class="model-badge-compact">${val}</span>` : '—' },
                { key: 'rating', label: 'Rating', width: '90px', render: (val) => renderStars(val) },
                { key: 'rating_comment', label: '', width: '25px', render: (val) => val ? '<span title="Has comment">💬</span>' : '' }
            ],
            onRowClick: (item) => this._showConversationDetail(item),
            emptyMessage: 'No conversations found'
        });
        
        this._paginations.conversations = new Pagination(`${id}-conversations-pagination`, {
            onPageChange: (page, offset) => {
                state.setPagination(appId, 'conversations', { offset });
                this.loadConversations();
            }
        });
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        const id = this._containerId;
        const appId = this._app.id;
        
        // View all feedback button
        const viewAllBtn = document.getElementById(`${id}-view-all-feedback`);
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                state.setView('feedback');
            });
        }
        
        // Clients filters
        this._setupFilterListeners('clients', ['search', 'date-from', 'date-to']);
        
        // Sessions filters
        this._setupFilterListeners('sessions', ['client-id', 'date-from', 'date-to', 'min-duration']);
        
        // Searches filters
        this._setupFilterListeners('searches', ['query', 'date-from', 'date-to', 'min-results', 'max-results']);
        
        // Conversations filters
        this._setupFilterListeners('conversations', ['question', 'date-from', 'date-to', 'has-rating', 'rating-min']);
        
        // Feedback filters
        const feedbackRatingFilter = document.getElementById(`${id}-feedback-rating-filter`);
        const feedbackCommentFilter = document.getElementById(`${id}-feedback-comment-filter`);
        
        if (feedbackRatingFilter) {
            feedbackRatingFilter.addEventListener('change', () => this._filterFeedback());
        }
        if (feedbackCommentFilter) {
            feedbackCommentFilter.addEventListener('change', () => this._filterFeedback());
        }
        
        // Export buttons
        ['clients', 'sessions', 'searches', 'conversations'].forEach(view => {
            const exportBtn = document.getElementById(`${id}-${view}-export`);
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this._exportData(view));
            }
        });
        
        // Global click handler for clickable IDs and timeline items
        this._setupGlobalClickHandlers();
    }
    
    /**
     * Set up global click handlers for interactive elements in modals
     * Uses a static flag to ensure handlers are only setup once globally
     */
    _setupGlobalClickHandlers() {
        // Use a static/global flag on the class to ensure only ONE handler is registered
        if (AppViewManager._globalHandlersSetup) return;
        AppViewManager._globalHandlersSetup = true;
        
        // Store reference to all managers by appId
        if (!AppViewManager._managers) {
            AppViewManager._managers = {};
        }
        AppViewManager._managers[this._app.id] = this;
        
        // Single global click handler
        document.addEventListener('click', async (e) => {
            // Get the appId from the clicked element or its parents
            let appId = null;
            let targetEl = e.target;
            
            // Try to find appId from various sources
            const findAppId = (el) => {
                if (!el) return null;
                // Check data-app-id on element or parents
                const withAppId = el.closest('[data-app-id]');
                if (withAppId && withAppId.dataset.appId) {
                    return withAppId.dataset.appId;
                }
                // Check modal content
                const modalContent = el.closest('.modal-body');
                if (modalContent) {
                    const inner = modalContent.querySelector('[data-app-id]');
                    if (inner && inner.dataset.appId) {
                        return inner.dataset.appId;
                    }
                }
                return null;
            };
            
            // Handle clickable IDs
            const clickableId = e.target.closest('.clickable-id');
            if (clickableId) {
                e.preventDefault();
                e.stopPropagation();
                const type = clickableId.dataset.type;
                const id = clickableId.dataset.id;
                appId = clickableId.dataset.appId || findAppId(clickableId);
                
                if (appId && id) {
                    const manager = AppViewManager._managers[appId];
                    if (manager) {
                        await manager._handleClickableIdDirect(type, id);
                    }
                }
                return;
            }
            
            // Handle related link buttons
            const relatedBtn = e.target.closest('.related-link-btn');
            if (relatedBtn) {
                e.preventDefault();
                e.stopPropagation();
                const type = relatedBtn.dataset.type;
                const id = relatedBtn.dataset.id;
                appId = relatedBtn.dataset.appId || findAppId(relatedBtn);
                
                if (appId && id) {
                    const manager = AppViewManager._managers[appId];
                    if (manager) {
                        await manager._handleRelatedLinkDirect(type, id);
                    }
                }
                return;
            }
            
            // Handle timeline item clicks
            const timelineItem = e.target.closest('.timeline-item-enhanced');
            if (timelineItem) {
                const timelineWrapper = timelineItem.closest('.timeline-clickable');
                appId = timelineWrapper?.dataset.appId || findAppId(timelineItem);
                
                if (appId) {
                    const manager = AppViewManager._managers[appId];
                    if (manager) {
                        const type = timelineItem.dataset.type;
                        const id = timelineItem.dataset.id;
                        const index = parseInt(timelineItem.dataset.index);
                        manager._handleTimelineItemClick(type, id, index);
                    }
                }
                return;
            }
            
            // Handle feedback item clicks
            const feedbackItem = e.target.closest('.feedback-item[data-id]');
            if (feedbackItem) {
                appId = feedbackItem.dataset.appId || findAppId(feedbackItem);
                const feedbackId = feedbackItem.dataset.id;
                
                if (appId && feedbackId) {
                    const manager = AppViewManager._managers[appId];
                    if (manager) {
                        manager._handleFeedbackClick(feedbackId);
                    }
                }
                return;
            }
            
            // Handle context document card clicks
            const contextDocCard = e.target.closest('.context-doc-card');
            if (contextDocCard) {
                e.preventDefault();
                e.stopPropagation();
                const docId = contextDocCard.dataset.docId;
                appId = contextDocCard.dataset.appId || findAppId(contextDocCard);
                
                if (appId && docId) {
                    const manager = AppViewManager._managers[appId];
                    if (manager) {
                        await manager._handleContextDocClick(docId);
                    }
                }
                return;
            }
        });
    }
    
    /**
     * Register this manager (called after construction for subsequent managers)
     */
    _registerManager() {
        if (!AppViewManager._managers) {
            AppViewManager._managers = {};
        }
        AppViewManager._managers[this._app.id] = this;
    }
    
    /**
     * Handle context document card click - show expanded overlay
     */
    async _handleContextDocClick(docId) {
        const appId = this._app.id;
        const conv = this._data.currentConversation;
        if (!conv || !conv.context) return;
        
        const contextItems = conv.context.filter(c => 
            (c.document_id || c.title) === docId || c.document_id === docId
        );
        
        if (contextItems.length === 0) return;
        
        // Get metadata from first context item
        const metadata = contextItems[0].metadata || {};
        
        const doc = {
            id: docId,
            title: contextItems[0].title || docId,
            pages: contextItems.map(c => ({
                page: c.page,
                page_number: c.page,
                score: c.score || 0,
                text: c.snippet || c.text || '',
                have_text: !!(c.snippet || c.text)
            })).sort((a, b) => (a.page || 0) - (b.page || 0)),
            metadata: metadata
        };
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: `Document: ${truncateText(doc.title, 50)}`,
            size: 'large',
            content: renderContextDocumentOverlay(doc, appId, this._cardConfig)
        });
        
        // Load page previews after modal opens
        setTimeout(() => this._loadOverlayPagePreviews(doc.id, doc.pages), 150);
    }
    
    /**
     * Load preview images for pages in document overlay
     */
    async _loadOverlayPagePreviews(docId, pages) {
        const appId = this._app.id;
        
        for (const page of pages) {
            const pageNum = page.page || page.page_number;
            const container = document.querySelector(
                `.page-preview-container[data-doc-id="${docId}"][data-page="${pageNum}"]`
            );
            
            if (container) {
                await this._loadPreviewImage(container, docId, pageNum);
            }
        }
    }
    
    /**
     * Handle clickable ID clicks - direct call without appId param
     */
    async _handleClickableIdDirect(type, id) {
        if (!id) return;
        
        const appId = this._app.id;
        
        if (type === 'client') {
            // Show loading state in modal
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Client: ${truncateId(id)}`,
                size: 'large',
                content: '<div class="modal-loading"><div class="spinner"></div><p>Loading client details...</p></div>'
            });
            
            try {
                const [detail, timeline] = await Promise.all([
                    analyticsService.getClientDetail(appId, id),
                    analyticsService.getClientTimeline(appId, id, 50, 0)
                ]);
                
                // Update modal content
                eventBus.emit(Events.MODAL_OPEN, {
                    title: `Client: ${truncateId(detail.id)}`,
                    size: 'large',
                    content: this._renderClientDetailHTML(detail, timeline)
                });
            } catch (error) {
                console.error('Failed to load client:', error);
                eventBus.emit(Events.MODAL_OPEN, {
                    title: 'Error',
                    size: 'small',
                    content: '<div class="modal-error"><p>Failed to load client details</p></div>'
                });
            }
        } else if (type === 'session') {
            // Show loading state in modal
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Session: ${truncateId(id)}`,
                size: 'large',
                content: '<div class="modal-loading"><div class="spinner"></div><p>Loading session details...</p></div>'
            });
            
            try {
                const [detail, timeline] = await Promise.all([
                    analyticsService.getSessionDetail(appId, id),
                    analyticsService.getSessionTimeline(appId, id)
                ]);
                
                this._data.sessionTimeline = timeline;
                
                // Update modal content
                eventBus.emit(Events.MODAL_OPEN, {
                    title: `Session: ${truncateId(detail.id)}`,
                    size: 'large',
                    content: this._renderSessionDetailHTML(detail, timeline)
                });
            } catch (error) {
                console.error('Failed to load session:', error);
                eventBus.emit(Events.MODAL_OPEN, {
                    title: 'Error',
                    size: 'small',
                    content: '<div class="modal-error"><p>Failed to load session details</p></div>'
                });
            }
        }
    }
    
    /**
     * Handle related link button clicks - direct call
     */
    async _handleRelatedLinkDirect(type, id) {
        if (!id) return;
        
        if (type === 'conversation') {
            let conversation = this._data.conversations?.find(c => c.id === id);
            if (!conversation && this._data.feedback?.feedback) {
                conversation = this._data.feedback.feedback.find(f => f.id === id);
            }
            if (conversation) {
                this._showConversationDetail(conversation);
            }
        } else if (type === 'session') {
            await this._handleClickableIdDirect('session', id);
        }
    }
    
    /**
     * Legacy handler - kept for backwards compatibility
     */
    async _handleClickableId(type, id, appId) {
        await this._handleClickableIdDirect(type, id);
    }
    
    /**
     * Legacy handler - kept for backwards compatibility  
     */
    async _handleRelatedLink(type, id, appId) {
        await this._handleRelatedLinkDirect(type, id);
    }
    
    /**
     * Handle timeline item clicks
     */
    async _handleTimelineItemClick(type, id, index) {
        if (!type) return;
        
        const appId = this._app.id;
        
        if (type === 'search') {
            // Try to get search from cached session timeline
            if (this._data.sessionTimeline?.items) {
                const search = this._data.sessionTimeline.items[index];
                if (search && search.type === 'search') {
                    this._showSearchDetail(search);
                    return;
                }
            }
            // Fallback: fetch searches
            if (id) {
                try {
                    const searches = await analyticsService.listSearches(appId, { limit: 100 });
                    const search = searches.items?.find(s => s.id === id);
                    if (search) {
                        this._showSearchDetail(search);
                    }
                } catch (error) {
                    console.error('Failed to load search:', error);
                }
            }
        } else if (type === 'conversation') {
            // Try to get conversation from cached session timeline
            if (this._data.sessionTimeline?.items) {
                const conversation = this._data.sessionTimeline.items[index];
                if (conversation && conversation.type === 'conversation') {
                    this._showConversationDetail(conversation);
                    return;
                }
            }
            // Fallback: fetch conversations
            if (id) {
                try {
                    const conversations = await analyticsService.listConversations(appId, { limit: 100 });
                    const conversation = conversations.items?.find(c => c.id === id);
                    if (conversation) {
                        this._showConversationDetail(conversation);
                    }
                } catch (error) {
                    console.error('Failed to load conversation:', error);
                }
            }
        }
    }
    
    /**
     * Handle feedback item clicks
     */
    async _handleFeedbackClick(feedbackId) {
        if (!feedbackId) return;
        
        // Find in cached feedback
        let feedback = this._data.feedback?.feedback?.find(f => f.id === feedbackId);
        if (!feedback && this._data.dashboard?.feedback) {
            feedback = this._data.dashboard.feedback.find(f => f.id === feedbackId);
        }
        
        if (feedback) {
            // Show conversation detail (feedback is essentially a conversation with rating)
            this._showConversationDetail(feedback);
        }
    }
    
    /**
     * Set up filter listeners for a view
     */
    _setupFilterListeners(viewName, filterFields) {
        const id = this._containerId;
        
        const applyBtn = document.getElementById(`${id}-${viewName}-apply`);
        const resetBtn = document.getElementById(`${id}-${viewName}-reset`);
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters(viewName));
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters(viewName, filterFields));
        }
        
        // Enter key on text inputs
        filterFields.forEach(field => {
            const input = document.getElementById(`${id}-${viewName}-${field}`);
            if (input && (input.type === 'text' || input.type === 'number')) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this._applyFilters(viewName);
                    }
                });
            }
        });
    }
    
    // =========================================================================
    // View Control
    // =========================================================================
    
    /**
     * Show this app's views
     */
    show() {
        if (this._container) {
            this._container.classList.add('active');
        }
    }
    
    /**
     * Hide this app's views
     */
    hide() {
        if (this._container) {
            this._container.classList.remove('active');
        }
    }
    
    /**
     * Switch to a specific view within this app
     */
    switchView(viewName) {
        Object.entries(this._views).forEach(([name, element]) => {
            if (element) {
                element.classList.toggle('active', name === viewName);
            }
        });
    }
    
    // =========================================================================
    // Data Loading
    // =========================================================================
    
    /**
     * Load dashboard data
     */
    async loadDashboard() {
        const appId = this._app.id;
        const days = state.period;
        
        try {
            const [summary, activity, ratings, hourly, queries, feedback] = await Promise.all([
                analyticsService.getDashboardSummary(appId, days),
                analyticsService.getActivityByDay(appId, days),
                analyticsService.getRatingDistribution(appId),
                analyticsService.getHourlyDistribution(appId, days),
                analyticsService.getTopQueries(appId, 10, days),
                analyticsService.getRecentFeedback(appId, 5)
            ]);
            
            this._data.dashboard = { summary, activity, ratings, hourly, queries, feedback };
            this._renderDashboard();
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load dashboard:`, error);
        }
    }
    
    /**
     * Load clients data
     */
    async loadClients() {
        const appId = this._app.id;
        const pagination = state.getPagination(appId, 'clients');
        const filters = state.getFilters(appId, 'clients');
        
        this._tables.clients.showLoading();
        
        try {
            const response = await analyticsService.listClients(appId, {
                limit: pagination.limit,
                offset: pagination.offset,
                search: filters.search,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo
            });
            
            this._data.clients = response.items || [];
            
            state.setPagination(appId, 'clients', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._tables.clients.hideLoading();
            this._tables.clients.setData(this._data.clients);
            this._paginations.clients.update(response.total, response.limit, response.offset);
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load clients:`, error);
            this._tables.clients.hideLoading();
            this._tables.clients.setData([]);
        }
    }
    
    /**
     * Load sessions data
     */
    async loadSessions() {
        const appId = this._app.id;
        const pagination = state.getPagination(appId, 'sessions');
        const filters = state.getFilters(appId, 'sessions');
        
        this._tables.sessions.showLoading();
        
        try {
            const response = await analyticsService.listSessions(appId, {
                limit: pagination.limit,
                offset: pagination.offset,
                clientId: filters.clientId,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                minDuration: filters.minDuration
            });
            
            this._data.sessions = response.items || [];
            
            state.setPagination(appId, 'sessions', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._tables.sessions.hideLoading();
            this._tables.sessions.setData(this._data.sessions);
            this._paginations.sessions.update(response.total, response.limit, response.offset);
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load sessions:`, error);
            this._tables.sessions.hideLoading();
            this._tables.sessions.setData([]);
        }
    }
    
    /**
     * Load searches data
     */
    async loadSearches() {
        const appId = this._app.id;
        const pagination = state.getPagination(appId, 'searches');
        const filters = state.getFilters(appId, 'searches');
        
        this._tables.searches.showLoading();
        
        try {
            const response = await analyticsService.listSearches(appId, {
                limit: pagination.limit,
                offset: pagination.offset,
                queryContains: filters.queryContains,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                minResults: filters.minResults,
                maxResults: filters.maxResults
            });
            
            this._data.searches = response.items || [];
            
            state.setPagination(appId, 'searches', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._tables.searches.hideLoading();
            this._tables.searches.setData(this._data.searches);
            this._paginations.searches.update(response.total, response.limit, response.offset);
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load searches:`, error);
            this._tables.searches.hideLoading();
            this._tables.searches.setData([]);
        }
    }
    
    /**
     * Load conversations data
     */
    async loadConversations() {
        const appId = this._app.id;
        const pagination = state.getPagination(appId, 'conversations');
        const filters = state.getFilters(appId, 'conversations');
        
        this._tables.conversations.showLoading();
        
        try {
            const response = await analyticsService.listConversations(appId, {
                limit: pagination.limit,
                offset: pagination.offset,
                questionContains: filters.questionContains,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                hasRating: filters.hasRating,
                ratingMin: filters.ratingMin
            });
            
            this._data.conversations = response.items || [];
            
            state.setPagination(appId, 'conversations', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._tables.conversations.hideLoading();
            this._tables.conversations.setData(this._data.conversations);
            this._paginations.conversations.update(response.total, response.limit, response.offset);
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load conversations:`, error);
            this._tables.conversations.hideLoading();
            this._tables.conversations.setData([]);
        }
    }
    
    /**
     * Load feedback data
     */
    async loadFeedback() {
        const appId = this._app.id;
        const days = state.period;
        
        try {
            const [distribution, feedback, summary] = await Promise.all([
                analyticsService.getRatingDistribution(appId),
                analyticsService.getRecentFeedback(appId, 100),
                analyticsService.getDashboardSummary(appId, days)
            ]);
            
            this._data.feedback = { distribution, feedback, summary };
            this._renderFeedback();
        } catch (error) {
            console.error(`[AppViewManager:${appId}] Failed to load feedback:`, error);
        }
    }
    
    /**
     * Load view data based on view name
     */
    async loadView(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'clients':
                await this.loadClients();
                break;
            case 'sessions':
                await this.loadSessions();
                break;
            case 'searches':
                await this.loadSearches();
                break;
            case 'conversations':
                await this.loadConversations();
                break;
            case 'feedback':
                await this.loadFeedback();
                break;
        }
    }
    
    // =========================================================================
    // Rendering
    // =========================================================================
    
    _renderDashboard() {
        const { summary, activity, ratings, hourly, queries, feedback } = this._data.dashboard || {};
        const id = this._containerId;
        
        // KPIs
        if (summary) {
            this._setElementText(`${id}-kpi-clients-value`, this._formatNumber(summary.total_clients));
            this._setElementText(`${id}-kpi-clients-sub`, `${summary.new_clients || 0} new`);
            this._setElementText(`${id}-kpi-sessions-value`, this._formatNumber(summary.total_sessions));
            this._setElementText(`${id}-kpi-sessions-sub`, `${(summary.avg_session_duration || 0).toFixed(1)} min avg`);
            this._setElementText(`${id}-kpi-searches-value`, this._formatNumber(summary.total_searches));
            this._setElementText(`${id}-kpi-searches-sub`, `${(summary.avg_search_results || 0).toFixed(1)} avg results`);
            this._setElementText(`${id}-kpi-conversations-value`, this._formatNumber(summary.total_conversations));
            this._setElementText(`${id}-kpi-conversations-sub`, `${(summary.avg_rating || 0).toFixed(1)} avg rating`);
        }
        
        // Activity chart
        if (activity && this._charts.activity) {
            const labels = activity.map(d => this._formatChartDate(d.date));
            const datasets = [
                { label: 'Sessions', data: activity.map(d => d.sessions), borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)' },
                { label: 'Searches', data: activity.map(d => d.searches), borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)' },
                { label: 'Conversations', data: activity.map(d => d.conversations), borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)' }
            ];
            this._charts.activity.setData(labels, datasets);
        }
        
        // Rating chart
        if (ratings && this._charts.rating) {
            const labels = ratings.map(r => `${r.rating} ★`);
            const datasets = [{ data: ratings.map(r => r.count), backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'], borderRadius: 4 }];
            this._charts.rating.setData(labels, datasets);
        }
        
        // Hourly chart
        if (hourly && this._charts.hourly) {
            const labels = hourly.map(h => `${h.hour}h`);
            const datasets = [{ data: hourly.map(h => h.activity_count), backgroundColor: config.chartColors.primary, borderRadius: 4 }];
            this._charts.hourly.setData(labels, datasets);
        }
        
        // Queries chart
        if (queries && this._charts.queries) {
            const labels = queries.map(q => truncateText(q.query, 30));
            const datasets = [{ data: queries.map(q => q.count), backgroundColor: config.chartColors.secondary, borderRadius: 4 }];
            this._charts.queries.setData(labels, datasets);
        }
        
        // Recent feedback
        this._renderRecentFeedback(feedback);
    }
    
    _renderRecentFeedback(feedback) {
        const container = document.getElementById(`${this._containerId}-recent-feedback`);
        if (!container) return;
        
        const appId = this._app.id;
        
        if (!feedback || feedback.length === 0) {
            container.innerHTML = `<div class="feedback-item"><p style="color: var(--text-muted); text-align: center;">No recent feedback</p></div>`;
            return;
        }
        
        container.innerHTML = feedback.map(item => `
            <div class="feedback-item" data-id="${item.id}" data-app-id="${appId}">
                <div class="feedback-header">
                    <div class="feedback-rating">${this._renderStarsHtml(item.rating)}</div>
                    <span class="feedback-date">${formatDate(item.rated_at, 'full')}</span>
                </div>
                <p class="feedback-question">${this._escapeHtml(item.question)}</p>
                ${item.rating_comment ? `<p class="feedback-comment">"${this._escapeHtml(item.rating_comment)}"</p>` : ''}
            </div>
        `).join('');
    }
    
    _renderFeedback() {
        const { distribution, feedback, summary } = this._data.feedback || {};
        const id = this._containerId;
        
        // Stats
        if (summary) {
            this._setElementText(`${id}-feedback-avg-rating`, summary.avg_rating ? summary.avg_rating.toFixed(2) : '—');
            this._setElementHTML(`${id}-feedback-avg-stars`, this._renderStarsHtml(Math.round(summary.avg_rating || 0)));
            this._setElementText(`${id}-feedback-total-rated`, (summary.rated_conversations || 0).toLocaleString());
            this._setElementText(`${id}-feedback-with-comments`, feedback ? feedback.filter(f => f.rating_comment).length.toLocaleString() : '0');
        }
        
        // Chart
        if (distribution && this._charts.feedbackRating) {
            const labels = distribution.map(r => `${r.rating} ★`);
            const datasets = [{ data: distribution.map(r => r.count), backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'], borderRadius: 4 }];
            this._charts.feedbackRating.setData(labels, datasets);
        }
        
        // List
        this._renderFeedbackList(feedback);
    }
    
    _renderFeedbackList(feedback) {
        const container = document.getElementById(`${this._containerId}-feedback-list`);
        if (!container) return;
        
        const appId = this._app.id;
        
        // Apply filters
        const ratingFilter = document.getElementById(`${this._containerId}-feedback-rating-filter`)?.value || '';
        const commentFilter = document.getElementById(`${this._containerId}-feedback-comment-filter`)?.value || '';
        
        let filtered = feedback || [];
        
        if (ratingFilter === 'low') filtered = filtered.filter(f => f.rating <= 2);
        else if (ratingFilter === 'medium') filtered = filtered.filter(f => f.rating === 3);
        else if (ratingFilter === 'high') filtered = filtered.filter(f => f.rating >= 4);
        
        if (commentFilter === 'true') filtered = filtered.filter(f => f.rating_comment);
        
        if (filtered.length === 0) {
            container.innerHTML = `<div class="feedback-item"><p style="color: var(--text-muted); text-align: center; padding: 2rem;">No feedback found</p></div>`;
            return;
        }
        
        container.innerHTML = filtered.map(item => `
            <div class="feedback-item" data-id="${item.id}" data-app-id="${appId}">
                <div class="feedback-header">
                    <div class="feedback-rating">${this._renderStarsHtml(item.rating)}</div>
                    <span class="feedback-date">${formatDate(item.rated_at, 'full')}</span>
                </div>
                <p class="feedback-question">${this._escapeHtml(item.question)}</p>
                ${item.rating_comment ? `<p class="feedback-comment">"${this._escapeHtml(item.rating_comment)}"</p>` : ''}
            </div>
        `).join('');
    }
    
    _filterFeedback() {
        if (this._data.feedback?.feedback) {
            this._renderFeedbackList(this._data.feedback.feedback);
        }
    }
    
    // =========================================================================
    // Filters
    // =========================================================================
    
    _applyFilters(viewName) {
        const id = this._containerId;
        const appId = this._app.id;
        
        const filters = {};
        
        switch (viewName) {
            case 'clients':
                filters.search = document.getElementById(`${id}-clients-search`)?.value?.trim() || null;
                filters.dateFrom = this._getDateValue(`${id}-clients-date-from`);
                filters.dateTo = this._getDateValue(`${id}-clients-date-to`, true);
                break;
            case 'sessions':
                filters.clientId = document.getElementById(`${id}-sessions-client-id`)?.value?.trim() || null;
                filters.dateFrom = this._getDateValue(`${id}-sessions-date-from`);
                filters.dateTo = this._getDateValue(`${id}-sessions-date-to`, true);
                filters.minDuration = parseInt(document.getElementById(`${id}-sessions-min-duration`)?.value) || null;
                break;
            case 'searches':
                filters.queryContains = document.getElementById(`${id}-searches-query`)?.value?.trim() || null;
                filters.dateFrom = this._getDateValue(`${id}-searches-date-from`);
                filters.dateTo = this._getDateValue(`${id}-searches-date-to`, true);
                filters.minResults = parseInt(document.getElementById(`${id}-searches-min-results`)?.value) || null;
                filters.maxResults = parseInt(document.getElementById(`${id}-searches-max-results`)?.value) || null;
                break;
            case 'conversations':
                filters.questionContains = document.getElementById(`${id}-conversations-question`)?.value?.trim() || null;
                filters.dateFrom = this._getDateValue(`${id}-conversations-date-from`);
                filters.dateTo = this._getDateValue(`${id}-conversations-date-to`, true);
                const hasRating = document.getElementById(`${id}-conversations-has-rating`)?.value;
                filters.hasRating = hasRating === '' ? null : hasRating === 'true';
                filters.ratingMin = parseInt(document.getElementById(`${id}-conversations-rating-min`)?.value) || null;
                break;
        }
        
        state.setFilters(appId, viewName, filters);
        state.resetPagination(appId, viewName);
        this.loadView(viewName);
    }
    
    _resetFilters(viewName, filterFields) {
        const id = this._containerId;
        const appId = this._app.id;
        
        filterFields.forEach(field => {
            const el = document.getElementById(`${id}-${viewName}-${field}`);
            if (el) el.value = '';
        });
        
        state.clearFilters(appId, viewName);
        this.loadView(viewName);
    }
    
    _getDateValue(elementId, endOfDay = false) {
        const value = document.getElementById(elementId)?.value;
        if (!value) return null;
        return endOfDay ? new Date(value + 'T23:59:59').toISOString() : new Date(value).toISOString();
    }
    
    // =========================================================================
    // Detail Modals
    // =========================================================================
    
    async _showClientDetail(client) {
        const appId = this._app.id;
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Client Details',
            size: 'large',
            content: '<div class="loader-inline"><div class="loader-spinner"></div></div>'
        });
        
        try {
            const [detail, timeline] = await Promise.all([
                analyticsService.getClientDetail(appId, client.id),
                analyticsService.getClientTimeline(appId, client.id, 50, 0)
            ]);
            
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Client: ${truncateId(detail.id)}`,
                size: 'large',
                content: this._renderClientDetailHTML(detail, timeline)
            });
        } catch (error) {
            console.error('Failed to load client detail:', error);
            eventBus.emit(Events.MODAL_CLOSE);
        }
    }
    
    _renderClientDetailHTML(detail, timeline) {
        const appId = this._app.id;
        return `
            <div class="client-detail-content" data-app-id="${appId}">
                <div class="detail-section">
                    <h4 class="detail-title">Client Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Client ID</span><span class="detail-value">${detail.id}</span></div>
                        <div class="detail-item"><span class="detail-label">Fingerprint</span><span class="detail-value">${detail.fingerprint || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Platform</span><span class="detail-value">${detail.platform || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Language</span><span class="detail-value">${detail.language || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Screen</span><span class="detail-value">${detail.screen_resolution || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Timezone</span><span class="detail-value">${detail.timezone || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Created</span><span class="detail-value">${formatDate(detail.created_at, 'full')}</span></div>
                        <div class="detail-item"><span class="detail-label">Last Seen</span><span class="detail-value">${formatDate(detail.last_seen, 'full')}</span></div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-title">Statistics</h4>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Sessions</span><span class="detail-value">${detail.session_count || 0}</span></div>
                        <div class="detail-item"><span class="detail-label">Searches</span><span class="detail-value">${detail.total_searches || 0}</span></div>
                        <div class="detail-item"><span class="detail-label">Conversations</span><span class="detail-value">${detail.total_conversations || 0}</span></div>
                        <div class="detail-item"><span class="detail-label">Avg Rating</span><span class="detail-value">${detail.avg_rating ? detail.avg_rating.toFixed(1) + ' ★' : '—'}</span></div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-title">Recent Activity</h4>
                    ${this._renderTimelineHTML(timeline.activities || [])}
                </div>
            </div>
        `;
    }
    
    async _showSessionDetail(session) {
        const appId = this._app.id;
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Session Details',
            size: 'large',
            content: '<div class="loader-inline"><div class="loader-spinner"></div></div>'
        });
        
        try {
            const [detail, timeline] = await Promise.all([
                analyticsService.getSessionDetail(appId, session.id),
                analyticsService.getSessionTimeline(appId, session.id)
            ]);
            
            // Store timeline for click handling
            this._data.sessionTimeline = timeline;
            
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Session: ${truncateId(detail.id)}`,
                size: 'large',
                content: this._renderSessionDetailHTML(detail, timeline)
            });
        } catch (error) {
            console.error('Failed to load session detail:', error);
            eventBus.emit(Events.MODAL_CLOSE);
        }
    }
    
    _renderSessionDetailHTML(detail, timeline) {
        const appId = this._app.id;
        return `
            <div class="session-detail-content" data-app-id="${appId}">
                <div class="detail-section">
                    <h4 class="detail-title">Session Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Session ID</span><span class="detail-value">${detail.id}</span></div>
                        <div class="detail-item"><span class="detail-label">Client ID</span><span class="detail-value clickable-id" data-type="client" data-id="${detail.client_id}" data-app-id="${appId}">${detail.client_id}</span></div>
                        <div class="detail-item"><span class="detail-label">Started</span><span class="detail-value">${formatDate(detail.created_at, 'full')}</span></div>
                        <div class="detail-item"><span class="detail-label">Last Activity</span><span class="detail-value">${formatDate(detail.last_activity_at, 'full')}</span></div>
                        <div class="detail-item"><span class="detail-label">Duration</span><span class="detail-value">${detail.duration_minutes ? detail.duration_minutes.toFixed(1) + ' min' : '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">IP Address</span><span class="detail-value">${detail.ip_address || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Platform</span><span class="detail-value">${detail.platform || '—'}</span></div>
                        <div class="detail-item"><span class="detail-label">Language</span><span class="detail-value">${detail.client_language || '—'}</span></div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-title">Activity Summary</h4>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Searches</span><span class="detail-value">${detail.search_count || 0}</span></div>
                        <div class="detail-item"><span class="detail-label">Conversations</span><span class="detail-value">${detail.conversation_count || 0}</span></div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-title">Session Timeline</h4>
                    <p class="text-muted text-sm" style="margin-bottom: var(--space-3);">Click on any item to see full details</p>
                    ${this._renderTimelineHTML(timeline.items || [])}
                </div>
            </div>
        `;
    }
    
    _showSearchDetail(search) {
        const appId = this._app.id;
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Search Details',
            size: 'large',
            content: renderSearchDetail(search, appId)
        });
    }
    
    _showConversationDetail(conv) {
        const appId = this._app.id;
        
        // Store current conversation for context card clicks
        this._data.currentConversation = conv;
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Conversation Details',
            size: 'fullscreen',
            content: renderConversationDetail(conv, appId)
        });
        
        // Load context document previews after modal is shown
        setTimeout(() => this._loadContextPreviews(conv), 100);
    }
    
    /**
     * Load preview images for context documents
     */
    async _loadContextPreviews(conv) {
        const appId = this._app.id;
        const contextItems = conv.context || [];
        if (contextItems.length === 0) return;
        
        // Group by document to find best page per doc
        const grouped = {};
        contextItems.forEach((ctx, index) => {
            const docId = ctx.document_id || `doc_${index}`;
            if (!grouped[docId]) {
                grouped[docId] = { pages: [], maxScore: 0, bestPage: null };
            }
            grouped[docId].pages.push(ctx);
            if ((ctx.score || 0) > grouped[docId].maxScore) {
                grouped[docId].maxScore = ctx.score || 0;
                grouped[docId].bestPage = ctx.page;
            }
        });
        
        // Load preview for each document's best page
        for (const [docId, data] of Object.entries(grouped)) {
            const pageNum = data.bestPage || data.pages[0]?.page || 1;
            const previewEl = document.querySelector(`.context-doc-preview[data-doc-id="${docId}"]`);
            if (previewEl) {
                await this._loadPreviewImage(previewEl, docId, pageNum);
            }
        }
    }
    
    /**
     * Load a single preview image
     */
    async _loadPreviewImage(container, docId, pageNum) {
        const appId = this._app.id;
        
        try {
            // Build API URL: /pfs/{app_id}/files/fetch
            const baseUrl = config.getApiBaseUrl(appId).replace('/tracking', '');
            const url = `${baseUrl}/files/fetch`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: docId,
                    request_file_type: 'image',
                    page_number: pageNum
                })
            });
            
            if (!response.ok) throw new Error('Preview fetch failed');
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const placeholder = container.querySelector('.preview-placeholder');
            if (placeholder) {
                const img = document.createElement('img');
                img.src = blobUrl;
                img.alt = `Preview page ${pageNum}`;
                img.className = 'preview-image';
                placeholder.replaceWith(img);
            }
        } catch (error) {
            console.warn(`Failed to load preview for ${docId} page ${pageNum}:`, error);
            const placeholder = container.querySelector('.preview-placeholder');
            if (placeholder) {
                placeholder.innerHTML = '<span class="preview-error">📄</span>';
            }
        }
    }
    
    _renderTimelineHTML(items) {
        if (!items || items.length === 0) {
            return '<p style="color: var(--text-muted);">No activity recorded</p>';
        }
        
        // Use the enhanced timeline renderer
        const html = renderEnhancedTimeline(items.slice(0, 30));
        
        // Return with wrapper for click handling
        return `
            <div class="timeline-clickable" data-app-id="${this._app.id}">
                ${html}
            </div>
        `;
    }
    
    // =========================================================================
    // Export
    // =========================================================================
    
    _exportData(viewName) {
        const data = this._data[viewName];
        if (!data || data.length === 0) {
            eventBus.emit(Events.TOAST_SHOW, { message: 'No data to export', type: 'warning' });
            return;
        }
        
        const filename = exportService.generateFilename(`${this._app.id}-${viewName}`);
        exportService.exportCsv(data, filename);
        eventBus.emit(Events.TOAST_SHOW, { message: 'Export started', type: 'success' });
    }
    
    // =========================================================================
    // Helpers
    // =========================================================================
    
    _setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
    
    _setElementHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }
    
    _formatNumber(num) {
        if (num === null || num === undefined) return '—';
        return new Intl.NumberFormat(config.locale).format(num);
    }
    
    _formatChartDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString(config.locale, { month: 'short', day: 'numeric' });
    }
    
    _renderStarsHtml(rating) {
        if (!rating) return '<span class="text-muted">—</span>';
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
        }
        return html;
    }
    
    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Refresh charts after theme change
     */
    refreshCharts() {
        Object.values(this._charts).forEach(chart => {
            if (chart && typeof chart.refresh === 'function') {
                chart.refresh();
            }
        });
    }
}

export { AppViewManager };
