/**
 * ConversationsView.js
 * 
 * View for listing conversation history.
 * Displays questions, responses, ratings, and performance metrics.
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
    renderStars,
    renderBadge
} from '../components/index.js';

class ConversationsView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._dataTable = null;
        this._pagination = null;
        
        this._data = [];
    }
    
    /**
     * Initialize the conversations view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('conversations-view');
        this._initializeComponents();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize table and pagination components
     */
    _initializeComponents() {
        this._dataTable = new DataTable('conversations-table-container', {
            columns: this._getColumns(),
            onRowClick: (item) => this._showConversationDetail(item),
            emptyMessage: 'No conversations found'
        });
        
        this._pagination = new Pagination('conversations-pagination', {
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
                width: '150px',
                render: (val) => formatDate(val, 'full')
            },
            {
                key: 'question',
                label: 'Question',
                className: 'table-truncate',
                render: (val) => this._escapeHtml(truncateText(val, 50))
            },
            {
                key: 'response',
                label: 'Response',
                className: 'table-truncate',
                render: (val) => `<span style="color: var(--text-tertiary)">${this._escapeHtml(truncateText(val, 40))}</span>`
            },
            {
                key: 'response_time_ms',
                label: 'Time',
                width: '90px',
                render: (val) => formatDuration(val)
            },
            {
                key: 'rating',
                label: 'Rating',
                width: '100px',
                render: (val) => renderStars(val)
            },
            {
                key: 'rating_comment',
                label: 'Comment',
                width: '50px',
                render: (val) => val ? '<span title="Has comment">💬</span>' : '—'
            },
            {
                key: 'session_id',
                label: 'Session',
                width: '90px',
                render: (val) => `<span class="table-link" data-session="${val}">${truncateId(val)}</span>`
            }
        ];
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Apply filters
        const applyBtn = document.getElementById('conversations-apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters());
        }
        
        // Reset filters
        const resetBtn = document.getElementById('conversations-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters());
        }
        
        // Export
        const exportBtn = document.getElementById('conversations-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportData());
        }
        
        // Enter key in question filter
        const questionInput = document.getElementById('conversations-question');
        if (questionInput) {
            questionInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._applyFilters();
                }
            });
        }
        
        // Link clicks (event delegation)
        this._container?.addEventListener('click', (e) => {
            const sessionLink = e.target.closest('[data-session]');
            if (sessionLink) {
                e.stopPropagation();
                this._navigateToSession(sessionLink.dataset.session);
            }
        });
        
        // Refresh triggers
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'conversations') {
                this.load();
            }
        });
    }
    
    /**
     * Load conversations data
     */
    async load() {
        state.setLoading('conversations', true);
        this._dataTable.showLoading();
        
        const pagination = state.getPagination('conversations');
        const filters = state.getFilters('conversations');
        
        try {
            const response = await analyticsService.listConversations({
                limit: pagination.limit,
                offset: pagination.offset,
                questionContains: filters.questionContains,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                hasRating: filters.hasRating,
                ratingMin: filters.ratingMin,
                ratingMax: filters.ratingMax,
                hasComment: filters.hasComment
            });
            
            this._data = response.items || [];
            
            state.setPagination('conversations', {
                total: response.total,
                limit: response.limit,
                offset: response.offset
            });
            
            this._dataTable.hideLoading();
            this._dataTable.setData(this._data);
            this._pagination.update(response.total, response.limit, response.offset);
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[ConversationsView] Failed to load data:', error);
            this._dataTable.hideLoading();
            this._dataTable.setData([]);
        } finally {
            state.setLoading('conversations', false);
        }
    }
    
    /**
     * Handle page change
     * @param {number} offset - New offset
     */
    _handlePageChange(offset) {
        state.setPagination('conversations', { offset });
        this.load();
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        const questionContains = document.getElementById('conversations-question')?.value || '';
        const dateFrom = document.getElementById('conversations-date-from')?.value || '';
        const dateTo = document.getElementById('conversations-date-to')?.value || '';
        const hasRating = document.getElementById('conversations-has-rating')?.value || '';
        const ratingMin = document.getElementById('conversations-rating-min')?.value || '';
        
        state.setFilters('conversations', {
            questionContains: questionContains.trim() || null,
            dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
            dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
            hasRating: hasRating === '' ? null : hasRating === 'true',
            ratingMin: ratingMin ? parseInt(ratingMin, 10) : null
        });
        
        state.resetPagination('conversations');
        this.load();
    }
    
    /**
     * Reset filters
     */
    _resetFilters() {
        document.getElementById('conversations-question').value = '';
        document.getElementById('conversations-date-from').value = '';
        document.getElementById('conversations-date-to').value = '';
        document.getElementById('conversations-has-rating').value = '';
        document.getElementById('conversations-rating-min').value = '';
        
        state.clearFilters('conversations');
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
        
        const filename = exportService.generateFilename('conversations');
        exportService.exportCsv(this._data, filename, {
            columns: ['created_at', 'question', 'response', 'response_time_ms', 'rating', 'rating_comment', 'session_id', 'client_id'],
            headers: {
                created_at: 'Date',
                question: 'Question',
                response: 'Response',
                response_time_ms: 'Response Time (ms)',
                rating: 'Rating',
                rating_comment: 'Comment',
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
        state.selectSession(sessionId);
        state.setView('sessions');
    }
    
    /**
     * Show conversation detail modal
     * @param {Object} conversation - Conversation object
     */
    _showConversationDetail(conversation) {
        state.selectConversation(conversation.id);
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Conversation Details',
            size: 'large',
            content: this._renderConversationDetail(conversation)
        });
    }
    
    /**
     * Render conversation detail content
     * @param {Object} conv - Conversation object
     * @returns {string} HTML content
     */
    _renderConversationDetail(conv) {
        return `
            <div class="detail-section">
                <h4 class="detail-title">Question</h4>
                <div class="detail-content">${this._escapeHtml(conv.question)}</div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Response</h4>
                <div class="detail-content" style="max-height: 300px; overflow-y: auto;">
                    ${this._escapeHtml(conv.response)}
                </div>
            </div>
            
            ${conv.context && conv.context.length > 0 ? `
                <div class="detail-section">
                    <h4 class="detail-title">Context Used</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${conv.context.map(ctx => `
                            <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md);">
                                <strong>${this._escapeHtml(ctx.title || 'Document')}</strong>
                                ${ctx.page ? `<span style="color: var(--text-muted)"> - Page ${ctx.page}</span>` : ''}
                                ${ctx.snippet ? `
                                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                        ${this._escapeHtml(truncateText(ctx.snippet, 150))}
                                    </p>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${conv.rating ? `
                <div class="detail-section">
                    <h4 class="detail-title">Rating</h4>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 1.5rem;">${this._renderStarsHtml(conv.rating)}</div>
                        <span style="font-size: 1.5rem; font-weight: 600;">${conv.rating}/5</span>
                    </div>
                    ${conv.rating_comment ? `
                        <div class="detail-content" style="margin-top: 0.75rem; font-style: italic;">
                            "${this._escapeHtml(conv.rating_comment)}"
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4 class="detail-title">Performance</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Response Time</span>
                        <span class="detail-value">${formatDuration(conv.response_time_ms)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Tokens Used</span>
                        <span class="detail-value">${conv.tokens_used?.toLocaleString() || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Model</span>
                        <span class="detail-value">${conv.model_name || '—'}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">Context</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Conversation ID</span>
                        <span class="detail-value">${conv.id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Session ID</span>
                        <span class="detail-value">${conv.session_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Client ID</span>
                        <span class="detail-value">${conv.client_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Created</span>
                        <span class="detail-value">${formatDate(conv.created_at, 'full')}</span>
                    </div>
                    ${conv.rated_at ? `
                        <div class="detail-item">
                            <span class="detail-label">Rated</span>
                            <span class="detail-value">${formatDate(conv.rated_at, 'full')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Render stars HTML
     * @param {number} rating - Rating value
     * @returns {string} HTML string
     */
    _renderStarsHtml(rating) {
        if (!rating) return '<span class="text-muted">—</span>';
        
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= rating ? 'filled' : '';
            html += `<span class="star ${filled}">★</span>`;
        }
        return html;
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

export const conversationsView = new ConversationsView();
