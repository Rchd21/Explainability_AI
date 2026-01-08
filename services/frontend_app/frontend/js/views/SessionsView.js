/**
 * SessionsView.js
 * 
 * View for listing and displaying session details.
 * Shows session information and activity timeline.
 */

import { eventBus, Events, state, config } from '../core/index.js';
import { analyticsService, exportService } from '../services/index.js';
import { 
    DataTable, 
    Pagination,
    formatDate,
    formatDuration,
    truncateId,
    truncateText,
    renderBadge,
    renderLink
} from '../components/index.js';

class SessionsView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._dataTable = null;
        this._pagination = null;
        
        this._data = [];
    }
    
    /**
     * Initialize the sessions view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('sessions-view');
        this._initializeComponents();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize table and pagination components
     */
    _initializeComponents() {
        this._dataTable = new DataTable('sessions-table-container', {
            columns: this._getColumns(),
            onRowClick: (item) => this._showSessionDetail(item),
            emptyMessage: 'No sessions found'
        });
        
        this._pagination = new Pagination('sessions-pagination', {
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
                key: 'id',
                label: 'ID',
                width: '100px',
                render: (val) => `<span class="table-id">${truncateId(val)}</span>`
            },
            {
                key: 'client_id',
                label: 'Client',
                width: '100px',
                render: (val) => `<span class="table-link" data-client="${val}">${truncateId(val)}</span>`
            },
            {
                key: 'created_at',
                label: 'Started',
                render: (val) => formatDate(val, 'full')
            },
            {
                key: 'duration_minutes',
                label: 'Duration',
                render: (val) => val ? `${val.toFixed(1)} min` : '—'
            },
            {
                key: 'ip_address',
                label: 'IP',
                render: (val) => val || '—'
            },
            {
                key: 'platform',
                label: 'Platform',
                render: (val) => val || '—'
            },
            {
                key: 'search_count',
                label: 'Searches',
                render: (val) => renderBadge(val || 0, 'primary')
            },
            {
                key: 'conversation_count',
                label: 'Conversations',
                render: (val) => renderBadge(val || 0)
            }
        ];
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Apply filters
        const applyBtn = document.getElementById('sessions-apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters());
        }
        
        // Reset filters
        const resetBtn = document.getElementById('sessions-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters());
        }
        
        // Export
        const exportBtn = document.getElementById('sessions-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportData());
        }
        
        // Enter key in filters
        ['sessions-client-id', 'sessions-min-duration'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this._applyFilters();
                    }
                });
            }
        });
        
        // Client link clicks (using event delegation)
        this._container?.addEventListener('click', (e) => {
            const clientLink = e.target.closest('[data-client]');
            if (clientLink) {
                e.stopPropagation();
                const clientId = clientLink.dataset.client;
                this._navigateToClient(clientId);
            }
        });
        
        // Refresh triggers
        eventBus.on(Events.PERIOD_CHANGED, () => {
            if (state.currentView === 'sessions') {
                this.load();
            }
        });
        
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'sessions') {
                this.load();
            }
        });
    }
    
    /**
     * Load sessions data
     */
    async load() {
        state.setLoading('sessions', true);
        this._dataTable.showLoading();
        
        const pagination = state.getPagination('sessions');
        const filters = state.getFilters('sessions');
        
        try {
            const response = await analyticsService.listSessions({
                limit: pagination.limit,
                offset: pagination.offset,
                clientId: filters.clientId,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                minDuration: filters.minDuration
            });
            
            this._data = response.items || [];
            
            state.setPagination('sessions', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._dataTable.hideLoading();
            this._dataTable.setData(this._data);
            this._pagination.update(response.total, response.limit, response.offset);
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[SessionsView] Failed to load data:', error);
            this._dataTable.hideLoading();
            this._dataTable.setData([]);
        } finally {
            state.setLoading('sessions', false);
        }
    }
    
    /**
     * Handle page change
     * @param {number} offset - New offset
     */
    _handlePageChange(offset) {
        state.setPagination('sessions', { offset });
        this.load();
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        const clientId = document.getElementById('sessions-client-id')?.value || '';
        const dateFrom = document.getElementById('sessions-date-from')?.value || '';
        const dateTo = document.getElementById('sessions-date-to')?.value || '';
        const minDuration = document.getElementById('sessions-min-duration')?.value || '';
        
        state.setFilters('sessions', {
            clientId: clientId.trim() || null,
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
            dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
            minDuration: minDuration ? parseInt(minDuration, 10) : null
        });
        
        state.resetPagination('sessions');
        this.load();
    }
    
    /**
     * Reset filters
     */
    _resetFilters() {
        document.getElementById('sessions-client-id').value = '';
        document.getElementById('sessions-date-from').value = '';
        document.getElementById('sessions-date-to').value = '';
        document.getElementById('sessions-min-duration').value = '';
        
        state.clearFilters('sessions');
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
        
        const filename = exportService.generateFilename('sessions');
        exportService.exportCsv(this._data, filename, {
            columns: ['id', 'client_id', 'created_at', 'last_activity_at', 'duration_minutes', 'ip_address', 'platform', 'search_count', 'conversation_count'],
            headers: {
                id: 'Session ID',
                client_id: 'Client ID',
                created_at: 'Started',
                last_activity_at: 'Last Activity',
                duration_minutes: 'Duration (min)',
                ip_address: 'IP Address',
                platform: 'Platform',
                search_count: 'Searches',
                conversation_count: 'Conversations'
            }
        });
        
        eventBus.emit(Events.TOAST_SHOW, { 
            message: 'Export started', 
            type: 'success' 
        });
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
     * Show session detail modal
     * @param {Object} session - Session object
     */
    async _showSessionDetail(session) {
        state.selectSession(session.id);
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Session Details',
            size: 'large',
            content: '<div class="loader-inline"><div class="loader-spinner"></div></div>'
        });
        
        try {
            const [detail, timeline] = await Promise.all([
                analyticsService.getSessionDetail(session.id),
                analyticsService.getSessionTimeline(session.id)
            ]);
            
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Session: ${truncateId(detail.id)}`,
                size: 'large',
                content: this._renderSessionDetail(detail, timeline)
            });
        } catch (error) {
            console.error('[SessionsView] Failed to load session detail:', error);
            eventBus.emit(Events.MODAL_CLOSE);
        }
    }
    
    /**
     * Render session detail content
     * @param {Object} detail - Session detail
     * @param {Object} timeline - Session timeline
     * @returns {string} HTML content
     */
    _renderSessionDetail(detail, timeline) {
        return `
            <div class="detail-section">
                <h4 class="detail-title">Session Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Session ID</span>
                        <span class="detail-value">${detail.id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Client ID</span>
                        <span class="detail-value table-link" onclick="window.dispatchEvent(new CustomEvent('navigate-client', {detail: '${detail.client_id}'}))">${detail.client_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Started</span>
                        <span class="detail-value">${formatDate(detail.created_at, 'full')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Activity</span>
                        <span class="detail-value">${formatDate(detail.last_activity_at, 'full')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">${detail.duration_minutes ? detail.duration_minutes.toFixed(1) + ' min' : '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">IP Address</span>
                        <span class="detail-value">${detail.ip_address || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Platform</span>
                        <span class="detail-value">${detail.platform || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Language</span>
                        <span class="detail-value">${detail.client_language || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Screen Resolution</span>
                        <span class="detail-value">${detail.screen_resolution || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Timezone</span>
                        <span class="detail-value">${detail.client_timezone || '—'}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Activity Summary</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Searches</span>
                        <span class="detail-value">${detail.search_count || 0}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Conversations</span>
                        <span class="detail-value">${detail.conversation_count || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Session Timeline</h4>
                ${this._renderTimeline(timeline.items || [])}
            </div>
        `;
    }
    
    /**
     * Render activity timeline
     * @param {Array} items - Timeline items
     * @returns {string} HTML content
     */
    _renderTimeline(items) {
        if (items.length === 0) {
            return '<p style="color: var(--text-muted);">No activity recorded</p>';
        }
        
        return `
            <div class="timeline">
                ${items.map(item => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${item.type}"></div>
                        <div class="timeline-time">${formatDate(item.created_at, 'time')}</div>
                        <div class="timeline-content">
                            <div class="timeline-type ${item.type}">${item.type}</div>
                            <div class="timeline-text">${this._escapeHtml(truncateText(item.content, 150))}</div>
                            <div class="timeline-meta">
                                ${item.results_count !== null ? `<span>Results: ${item.results_count}</span>` : ''}
                                ${item.duration_ms !== null ? `<span>Duration: ${item.duration_ms}ms</span>` : ''}
                                ${item.rating !== null ? `<span>Rating: ${item.rating} ★</span>` : ''}
                            </div>
                            ${item.type === 'conversation' && item.response ? `
                                <details style="margin-top: 0.5rem;">
                                    <summary style="cursor: pointer; color: var(--text-secondary); font-size: 0.75rem;">View Response</summary>
                                    <div class="detail-content" style="margin-top: 0.5rem; font-size: 0.8rem;">
                                        ${this._escapeHtml(truncateText(item.response, 500))}
                                    </div>
                                </details>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
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

export const sessionsView = new SessionsView();
