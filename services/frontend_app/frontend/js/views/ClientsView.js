/**
 * ClientsView.js
 * 
 * View for listing and displaying client details.
 * Shows client information, statistics, and activity timeline.
 */

import { eventBus, Events, state, config } from '../core/index.js';
import { analyticsService, exportService } from '../services/index.js';
import { 
    DataTable, 
    Pagination,
    formatDate, 
    truncateId, 
    truncateText,
    renderBadge 
} from '../components/index.js';

class ClientsView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._dataTable = null;
        this._pagination = null;
        
        this._data = [];
        this._filters = {};
    }
    
    /**
     * Initialize the clients view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('clients-view');
        this._initializeComponents();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize table and pagination components
     */
    _initializeComponents() {
        // Data table
        this._dataTable = new DataTable('clients-table-container', {
            columns: this._getColumns(),
            onRowClick: (item) => this._showClientDetail(item),
            emptyMessage: 'No clients found'
        });
        
        // Pagination
        this._pagination = new Pagination('clients-pagination', {
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
                key: 'platform',
                label: 'Platform',
                render: (val) => val || '—'
            },
            {
                key: 'language',
                label: 'Language',
                render: (val) => val || '—'
            },
            {
                key: 'screen_resolution',
                label: 'Screen',
                render: (val) => val || '—'
            },
            {
                key: 'created_at',
                label: 'Created',
                render: (val) => formatDate(val, 'medium')
            },
            {
                key: 'last_seen',
                label: 'Last Seen',
                render: (val) => formatDate(val, 'medium')
            },
            {
                key: 'session_count',
                label: 'Sessions',
                render: (val) => renderBadge(val || 0, 'primary')
            },
            {
                key: 'total_searches',
                label: 'Searches',
                render: (val) => val?.toLocaleString() || '0'
            },
            {
                key: 'total_conversations',
                label: 'Conversations',
                render: (val) => val?.toLocaleString() || '0'
            }
        ];
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Apply filters button
        const applyBtn = document.getElementById('clients-apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters());
        }
        
        // Reset filters button
        const resetBtn = document.getElementById('clients-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters());
        }
        
        // Export button
        const exportBtn = document.getElementById('clients-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportData());
        }
        
        // Enter key in search
        const searchInput = document.getElementById('clients-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._applyFilters();
                }
            });
        }
        
        // Refresh on period change
        eventBus.on(Events.PERIOD_CHANGED, () => {
            if (state.currentView === 'clients') {
                this.load();
            }
        });
        
        // Refresh trigger
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'clients') {
                this.load();
            }
        });
    }
    
    /**
     * Load clients data
     */
    async load() {
        state.setLoading('clients', true);
        this._dataTable.showLoading();
        
        const pagination = state.getPagination('clients');
        const filters = state.getFilters('clients');
        
        try {
            const response = await analyticsService.listClients({
                limit: pagination.limit,
                offset: pagination.offset,
                search: filters.search,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo
            });
            
            this._data = response.items || [];
            
            // Update pagination state
            state.setPagination('clients', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            // Render
            this._dataTable.hideLoading();
            this._dataTable.setData(this._data);
            this._pagination.update(response.total, response.limit, response.offset);
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[ClientsView] Failed to load data:', error);
            this._dataTable.hideLoading();
            this._dataTable.setData([]);
        } finally {
            state.setLoading('clients', false);
        }
    }
    
    /**
     * Handle page change
     * @param {number} offset - New offset
     */
    _handlePageChange(offset) {
        state.setPagination('clients', { offset });
        this.load();
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        const search = document.getElementById('clients-search')?.value || '';
        const dateFrom = document.getElementById('clients-date-from')?.value || '';
        const dateTo = document.getElementById('clients-date-to')?.value || '';
        
        state.setFilters('clients', {
            search: search.trim(),
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
            dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null
        });
        
        // Reset to first page
        state.resetPagination('clients');
        this.load();
    }
    
    /**
     * Reset filters
     */
    _resetFilters() {
        document.getElementById('clients-search').value = '';
        document.getElementById('clients-date-from').value = '';
        document.getElementById('clients-date-to').value = '';
        
        state.clearFilters('clients');
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
        
        const filename = exportService.generateFilename('clients');
        exportService.exportCsv(this._data, filename, {
            columns: ['id', 'platform', 'language', 'screen_resolution', 'created_at', 'last_seen', 'session_count', 'total_searches', 'total_conversations'],
            headers: {
                id: 'Client ID',
                platform: 'Platform',
                language: 'Language',
                screen_resolution: 'Screen Resolution',
                created_at: 'Created At',
                last_seen: 'Last Seen',
                session_count: 'Sessions',
                total_searches: 'Total Searches',
                total_conversations: 'Total Conversations'
            }
        });
        
        eventBus.emit(Events.TOAST_SHOW, { 
            message: 'Export started', 
            type: 'success' 
        });
    }
    
    /**
     * Show client detail modal
     * @param {Object} client - Client object
     */
    async _showClientDetail(client) {
        state.selectClient(client.id);
        
        // Show modal with loading state
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Client Details',
            size: 'large',
            content: '<div class="loader-inline"><div class="loader-spinner"></div></div>'
        });
        
        try {
            // Load client detail and timeline in parallel
            const [detail, timeline] = await Promise.all([
                analyticsService.getClientDetail(client.id),
                analyticsService.getClientTimeline(client.id, 50, 0)
            ]);
            
            // Update modal content
            eventBus.emit(Events.MODAL_OPEN, {
                title: `Client: ${truncateId(detail.id)}`,
                size: 'large',
                content: this._renderClientDetail(detail, timeline)
            });
        } catch (error) {
            console.error('[ClientsView] Failed to load client detail:', error);
            eventBus.emit(Events.MODAL_CLOSE);
        }
    }
    
    /**
     * Render client detail content
     * @param {Object} detail - Client detail
     * @param {Object} timeline - Client timeline
     * @returns {string} HTML content
     */
    _renderClientDetail(detail, timeline) {
        return `
            <div class="detail-section">
                <h4 class="detail-title">Client Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Client ID</span>
                        <span class="detail-value">${detail.id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Fingerprint</span>
                        <span class="detail-value">${detail.fingerprint || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Platform</span>
                        <span class="detail-value">${detail.platform || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Language</span>
                        <span class="detail-value">${detail.language || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Screen Resolution</span>
                        <span class="detail-value">${detail.screen_resolution || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Timezone</span>
                        <span class="detail-value">${detail.timezone || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Created</span>
                        <span class="detail-value">${formatDate(detail.created_at, 'full')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Seen</span>
                        <span class="detail-value">${formatDate(detail.last_seen, 'full')}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Statistics</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Total Sessions</span>
                        <span class="detail-value">${detail.session_count || 0}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Searches</span>
                        <span class="detail-value">${detail.total_searches || 0}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Conversations</span>
                        <span class="detail-value">${detail.total_conversations || 0}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Average Rating</span>
                        <span class="detail-value">${detail.avg_rating ? detail.avg_rating.toFixed(1) + ' ★' : '—'}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">User Agent</h4>
                <div class="detail-content" style="font-size: 0.75rem; word-break: break-all;">
                    ${detail.user_agent || '—'}
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Recent Activity</h4>
                ${this._renderTimeline(timeline.activities || [])}
            </div>
        `;
    }
    
    /**
     * Render activity timeline
     * @param {Array} activities - Activity items
     * @returns {string} HTML content
     */
    _renderTimeline(activities) {
        if (activities.length === 0) {
            return '<p style="color: var(--text-muted);">No recent activity</p>';
        }
        
        return `
            <div class="timeline">
                ${activities.slice(0, 20).map(activity => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${activity.type}"></div>
                        <div class="timeline-time">${formatDate(activity.created_at, 'full')}</div>
                        <div class="timeline-content">
                            <div class="timeline-type ${activity.type}">${activity.type}</div>
                            <div class="timeline-text">${this._escapeHtml(truncateText(activity.content, 100))}</div>
                            <div class="timeline-meta">
                                ${activity.results_count !== null ? `<span>Results: ${activity.results_count}</span>` : ''}
                                ${activity.duration_ms !== null ? `<span>Duration: ${activity.duration_ms}ms</span>` : ''}
                                ${activity.rating !== null ? `<span>Rating: ${activity.rating} ★</span>` : ''}
                            </div>
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

export const clientsView = new ClientsView();
