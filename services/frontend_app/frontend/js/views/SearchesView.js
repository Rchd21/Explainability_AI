/**
 * SearchesView.js
 * 
 * View for listing search history.
 * Displays search queries, filters, results, and performance metrics.
 */

import { eventBus, Events, state } from '../core/index.js';
import { analyticsService, exportService } from '../services/index.js';
import { 
    DataTable, 
    Pagination,
    formatDate,
    formatDuration,
    truncateId,
    truncateText,
    renderBadge
} from '../components/index.js';

class SearchesView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._dataTable = null;
        this._pagination = null;
        
        this._data = [];
    }
    
    /**
     * Initialize the searches view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('searches-view');
        this._initializeComponents();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize table and pagination components
     */
    _initializeComponents() {
        this._dataTable = new DataTable('searches-table-container', {
            columns: this._getColumns(),
            onRowClick: (item) => this._showSearchDetail(item),
            emptyMessage: 'No searches found'
        });
        
        this._pagination = new Pagination('searches-pagination', {
            onPageChange: (page, offset) => this._handlePageChange(offset)
        });
    }
    
    /**
     * Get table column definitions
     * @returns {Array} Column definitions
     */
    _getColumns() {
        return [
            {
                key: 'created_at',
                label: 'Date',
                width: '160px',
                render: (val) => formatDate(val, 'full')
            },
            {
                key: 'query',
                label: 'Query',
                className: 'table-truncate',
                render: (val) => `<strong>${this._escapeHtml(truncateText(val, 60))}</strong>`
            },
            {
                key: 'filters',
                label: 'Filters',
                width: '100px',
                render: (val) => {
                    if (!val || val.length === 0) return '—';
                    return renderBadge(`${val.length} filter${val.length > 1 ? 's' : ''}`, 'primary');
                }
            },
            {
                key: 'results_count',
                label: 'Results',
                width: '80px',
                render: (val) => val?.toLocaleString() || '0'
            },
            {
                key: 'duration_ms',
                label: 'Duration',
                width: '100px',
                render: (val) => formatDuration(val)
            },
            {
                key: 'session_id',
                label: 'Session',
                width: '100px',
                render: (val) => `<span class="table-link" data-session="${val}">${truncateId(val)}</span>`
            },
            {
                key: 'client_id',
                label: 'Client',
                width: '100px',
                render: (val) => `<span class="table-link" data-client="${val}">${truncateId(val)}</span>`
            }
        ];
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Apply filters
        const applyBtn = document.getElementById('searches-apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters());
        }
        
        // Reset filters
        const resetBtn = document.getElementById('searches-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters());
        }
        
        // Export
        const exportBtn = document.getElementById('searches-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportData());
        }
        
        // Enter key in query filter
        const queryInput = document.getElementById('searches-query');
        if (queryInput) {
            queryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._applyFilters();
                }
            });
        }
        
        // Link clicks (event delegation)
        this._container?.addEventListener('click', (e) => {
            const sessionLink = e.target.closest('[data-session]');
            const clientLink = e.target.closest('[data-client]');
            
            if (sessionLink) {
                e.stopPropagation();
                this._navigateToSession(sessionLink.dataset.session);
            } else if (clientLink) {
                e.stopPropagation();
                this._navigateToClient(clientLink.dataset.client);
            }
        });
        
        // Refresh triggers
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'searches') {
                this.load();
            }
        });
    }
    
    /**
     * Load searches data
     */
    async load() {
        state.setLoading('searches', true);
        this._dataTable.showLoading();
        
        const pagination = state.getPagination('searches');
        const filters = state.getFilters('searches');
        
        try {
            const response = await analyticsService.listSearches({
                limit: pagination.limit,
                offset: pagination.offset,
                queryContains: filters.queryContains,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                minResults: filters.minResults,
                maxResults: filters.maxResults
            });
            
            this._data = response.items || [];
            
            state.setPagination('searches', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._dataTable.hideLoading();
            this._dataTable.setData(this._data);
            this._pagination.update(response.total, response.limit, response.offset);
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[SearchesView] Failed to load data:', error);
            this._dataTable.hideLoading();
            this._dataTable.setData([]);
        } finally {
            state.setLoading('searches', false);
        }
    }
    
    /**
     * Handle page change
     * @param {number} offset - New offset
     */
    _handlePageChange(offset) {
        state.setPagination('searches', { offset });
        this.load();
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        const queryContains = document.getElementById('searches-query')?.value || '';
        const dateFrom = document.getElementById('searches-date-from')?.value || '';
        const dateTo = document.getElementById('searches-date-to')?.value || '';
        const minResults = document.getElementById('searches-min-results')?.value || '';
        const maxResults = document.getElementById('searches-max-results')?.value || '';
        
        state.setFilters('searches', {
            queryContains: queryContains.trim() || null,
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
            dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
            minResults: minResults ? parseInt(minResults, 10) : null,
            maxResults: maxResults ? parseInt(maxResults, 10) : null
        });
        
        state.resetPagination('searches');
        this.load();
    }
    
    /**
     * Reset filters
     */
    _resetFilters() {
        document.getElementById('searches-query').value = '';
        document.getElementById('searches-date-from').value = '';
        document.getElementById('searches-date-to').value = '';
        document.getElementById('searches-min-results').value = '';
        document.getElementById('searches-max-results').value = '';
        
        state.clearFilters('searches');
        this.load();
    }
    
    /**
     * Export data to CSV
     */
    _exportData() {
        if (this._data.length === 0) {
            eventBus.emit(Events.TOAST_SHOW, { 
                message: 'No data to export', 
                type: 'warning' 
            });
            return;
        }
        
        const filename = exportService.generateFilename('searches');
        exportService.exportCsv(this._data, filename, {
            columns: ['created_at', 'query', 'results_count', 'duration_ms', 'session_id', 'client_id'],
            headers: {
                created_at: 'Date',
                query: 'Query',
                results_count: 'Results',
                duration_ms: 'Duration (ms)',
                session_id: 'Session ID',
                client_id: 'Client ID'
            }
        });
        
        eventBus.emit(Events.TOAST_SHOW, { 
            message: 'Export started', 
            type: 'success' 
        });
    }
    
    /**
     * Navigate to session view
     * @param {string} sessionId - Session ID
     */
    _navigateToSession(sessionId) {
        state.setFilters('sessions', { clientId: null });
        state.selectSession(sessionId);
        state.setView('sessions');
    }
    
    /**
     * Navigate to client view
     * @param {string} clientId - Client ID
     */
    _navigateToClient(clientId) {
        state.setFilters('clients', { search: clientId });
        state.setView('clients');
    }
    
    /**
     * Show search detail modal
     * @param {Object} search - Search object
     */
    _showSearchDetail(search) {
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Search Details',
            size: 'medium',
            content: this._renderSearchDetail(search)
        });
    }
    
    /**
     * Render search detail content
     * @param {Object} search - Search object
     * @returns {string} HTML content
     */
    _renderSearchDetail(search) {
        return `
            <div class="detail-section">
                <h4 class="detail-title">Query</h4>
                <div class="detail-content">${this._escapeHtml(search.query)}</div>
            </div>
            
            ${search.filters && search.filters.length > 0 ? `
                <div class="detail-section">
                    <h4 class="detail-title">Applied Filters</h4>
                    <div class="detail-content" style="font-family: var(--font-mono); font-size: 0.8rem;">
                        ${JSON.stringify(search.filters, null, 2)}
                    </div>
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4 class="detail-title">Search Parameters</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Score Threshold</span>
                        <span class="detail-value">${search.score_threshold ?? '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Score Strategy</span>
                        <span class="detail-value">${search.score_strategy || '—'}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Results</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Results Count</span>
                        <span class="detail-value">${search.results_count?.toLocaleString() || '0'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">${formatDuration(search.duration_ms)}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Context</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Search ID</span>
                        <span class="detail-value">${search.id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Session ID</span>
                        <span class="detail-value">${search.session_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Client ID</span>
                        <span class="detail-value">${search.client_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Timestamp</span>
                        <span class="detail-value">${formatDate(search.created_at, 'full')}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Escape HTML entities
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

export const searchesView = new SearchesView();
