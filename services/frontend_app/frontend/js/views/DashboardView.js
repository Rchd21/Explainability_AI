/**
 * DashboardView.js
 * 
 * Main dashboard view with KPIs, charts, and recent feedback.
 * Displays overview statistics and activity trends.
 */

import { eventBus, Events, state, config } from '../core/index.js';
import { analyticsService } from '../services/index.js';
import { 
    createActivityChart, 
    createRatingChart, 
    createHourlyChart, 
    createQueriesChart,
    formatDate,
    renderStars 
} from '../components/index.js';

class DashboardView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        // Chart instances
        this._activityChart = null;
        this._ratingChart = null;
        this._hourlyChart = null;
        this._queriesChart = null;
        
        // Data cache
        this._data = {
            summary: null,
            activity: null,
            ratings: null,
            hourly: null,
            queries: null,
            feedback: null
        };
    }
    
    /**
     * Initialize the dashboard view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('dashboard-view');
        this._initializeCharts();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize chart instances
     */
    _initializeCharts() {
        this._activityChart = createActivityChart('activity-chart');
        this._ratingChart = createRatingChart('rating-chart');
        this._hourlyChart = createHourlyChart('hourly-chart');
        this._queriesChart = createQueriesChart('queries-chart');
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Period change
        eventBus.on(Events.PERIOD_CHANGED, () => {
            if (state.currentView === 'dashboard') {
                this.load();
            }
        });
        
        // Refresh
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'dashboard') {
                this.load();
            }
        });
        
        // Theme change - refresh charts
        eventBus.on(Events.THEME_CHANGED, () => {
            this._refreshCharts();
        });
        
        // View all feedback button
        const viewAllBtn = document.getElementById('view-all-feedback');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                state.setView('feedback');
            });
        }
    }
    
    /**
     * Load dashboard data
     */
    async load() {
        state.setLoading('dashboard', true);
        
        const days = state.period;
        
        try {
            // Load all data in parallel
            const [summary, activity, ratings, hourly, queries, feedback] = await Promise.all([
                analyticsService.getDashboardSummary(days),
                analyticsService.getActivityByDay(days),
                analyticsService.getRatingDistribution(),
                analyticsService.getHourlyDistribution(days),
                analyticsService.getTopQueries(10, days),
                analyticsService.getRecentFeedback(5)
            ]);
            
            this._data = { summary, activity, ratings, hourly, queries, feedback };
            
            this._renderKPIs();
            this._renderActivityChart();
            this._renderRatingChart();
            this._renderHourlyChart();
            this._renderQueriesChart();
            this._renderRecentFeedback();
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[DashboardView] Failed to load data:', error);
        } finally {
            state.setLoading('dashboard', false);
        }
    }
    
    /**
     * Render KPI cards
     */
    _renderKPIs() {
        const { summary } = this._data;
        if (!summary) return;
        
        // Clients KPI
        this._updateKPI('clients', {
            value: this._formatNumber(summary.total_clients),
            sub: `${summary.new_clients} new`,
            trend: null
        });
        
        // Sessions KPI
        this._updateKPI('sessions', {
            value: this._formatNumber(summary.total_sessions),
            sub: `${summary.avg_session_duration?.toFixed(1) || 0} min avg`,
            trend: null
        });
        
        // Searches KPI
        this._updateKPI('searches', {
            value: this._formatNumber(summary.total_searches),
            sub: `${summary.avg_search_results?.toFixed(1) || 0} avg results`,
            trend: null
        });
        
        // Conversations KPI
        this._updateKPI('conversations', {
            value: this._formatNumber(summary.total_conversations),
            sub: `${summary.avg_rating?.toFixed(1) || '—'} avg rating`,
            trend: null
        });
    }
    
    /**
     * Update a KPI card
     * @param {string} name - KPI name
     * @param {Object} data - KPI data
     */
    _updateKPI(name, data) {
        const valueEl = document.getElementById(`kpi-${name}-value`);
        const subEl = document.getElementById(`kpi-${name}-sub`);
        const trendEl = document.getElementById(`kpi-${name}-trend`);
        
        if (valueEl) valueEl.textContent = data.value;
        if (subEl) subEl.textContent = data.sub;
        if (trendEl) {
            if (data.trend) {
                trendEl.textContent = data.trend.label;
                trendEl.className = `kpi-trend ${data.trend.positive ? 'positive' : 'negative'}`;
            } else {
                trendEl.textContent = '';
                trendEl.className = 'kpi-trend';
            }
        }
    }
    
    /**
     * Render activity chart
     */
    _renderActivityChart() {
        const { activity } = this._data;
        if (!activity || !this._activityChart) return;
        
        const colors = config.chartColors;
        
        const labels = activity.map(d => this._formatChartDate(d.date));
        
        const datasets = [
            {
                label: 'Sessions',
                data: activity.map(d => d.sessions),
                borderColor: colors.sessions,
                backgroundColor: this._hexToRgba(colors.sessions, 0.1)
            },
            {
                label: 'Searches',
                data: activity.map(d => d.searches),
                borderColor: colors.searches,
                backgroundColor: this._hexToRgba(colors.searches, 0.1)
            },
            {
                label: 'Conversations',
                data: activity.map(d => d.conversations),
                borderColor: colors.conversations,
                backgroundColor: this._hexToRgba(colors.conversations, 0.1)
            }
        ];
        
        this._activityChart.setData(labels, datasets);
    }
    
    /**
     * Render rating distribution chart
     */
    _renderRatingChart() {
        const { ratings } = this._data;
        if (!ratings || !this._ratingChart) return;
        
        const labels = ratings.map(r => `${r.rating} ★`);
        
        const datasets = [{
            data: ratings.map(r => r.count),
            backgroundColor: [
                '#ef4444',  // 1 star - red
                '#f59e0b',  // 2 stars - orange
                '#eab308',  // 3 stars - yellow
                '#22c55e',  // 4 stars - green
                '#10b981'   // 5 stars - emerald
            ],
            borderRadius: 4
        }];
        
        this._ratingChart.setData(labels, datasets);
    }
    
    /**
     * Render hourly distribution chart
     */
    _renderHourlyChart() {
        const { hourly } = this._data;
        if (!hourly || !this._hourlyChart) return;
        
        const labels = hourly.map(h => `${h.hour}h`);
        
        const datasets = [{
            data: hourly.map(h => h.activity_count),
            backgroundColor: config.chartColors.primary,
            borderRadius: 4
        }];
        
        this._hourlyChart.setData(labels, datasets);
    }
    
    /**
     * Render top queries chart
     */
    _renderQueriesChart() {
        const { queries } = this._data;
        if (!queries || !this._queriesChart) return;
        
        const labels = queries.map(q => this._truncateQuery(q.query, 30));
        
        const datasets = [{
            data: queries.map(q => q.count),
            backgroundColor: config.chartColors.secondary,
            borderRadius: 4
        }];
        
        this._queriesChart.setData(labels, datasets);
    }
    
    /**
     * Render recent feedback list
     */
    _renderRecentFeedback() {
        const { feedback } = this._data;
        const container = document.getElementById('recent-feedback-list');
        if (!container) return;
        
        if (!feedback || feedback.length === 0) {
            container.innerHTML = `
                <div class="feedback-item">
                    <p style="color: var(--text-muted); text-align: center;">No recent feedback</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = feedback.map(item => `
            <div class="feedback-item" data-id="${item.id}">
                <div class="feedback-header">
                    <div class="feedback-rating">
                        ${this._renderStarsHtml(item.rating)}
                    </div>
                    <span class="feedback-date">${formatDate(item.rated_at, 'full')}</span>
                </div>
                <p class="feedback-question">${this._escapeHtml(item.question)}</p>
                ${item.rating_comment ? `
                    <p class="feedback-comment">"${this._escapeHtml(item.rating_comment)}"</p>
                ` : ''}
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.feedback-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const feedbackItem = feedback.find(f => f.id === id);
                if (feedbackItem) {
                    this._showFeedbackDetail(feedbackItem);
                }
            });
        });
    }
    
    /**
     * Show feedback detail modal
     * @param {Object} item - Feedback item
     */
    _showFeedbackDetail(item) {
        eventBus.emit(Events.MODAL_OPEN, {
            title: 'Feedback Detail',
            size: 'medium',
            content: `
                <div class="detail-section">
                    <h4 class="detail-title">Rating</h4>
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">
                        ${this._renderStarsHtml(item.rating)}
                    </div>
                    ${item.rating_comment ? `
                        <p class="detail-content">"${this._escapeHtml(item.rating_comment)}"</p>
                    ` : ''}
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Question</h4>
                    <div class="detail-content">${this._escapeHtml(item.question)}</div>
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Response</h4>
                    <div class="detail-content">${this._escapeHtml(item.response)}</div>
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Conversation ID</span>
                            <span class="detail-value">${item.id?.slice(0, 8) || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Session ID</span>
                            <span class="detail-value">${item.session_id?.slice(0, 8) || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Created</span>
                            <span class="detail-value">${formatDate(item.created_at, 'full')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Rated</span>
                            <span class="detail-value">${formatDate(item.rated_at, 'full')}</span>
                        </div>
                    </div>
                </div>
            `
        });
    }
    
    /**
     * Refresh all charts (e.g., after theme change)
     */
    _refreshCharts() {
        this._activityChart?.refresh();
        this._ratingChart?.refresh();
        this._hourlyChart?.refresh();
        this._queriesChart?.refresh();
    }
    
    // =========================================================================
    // Helper Methods
    // =========================================================================
    
    /**
     * Format number with locale
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    _formatNumber(num) {
        if (num === null || num === undefined) return '—';
        return new Intl.NumberFormat(config.locale).format(num);
    }
    
    /**
     * Format date for chart labels
     * @param {string} date - ISO date string
     * @returns {string} Formatted date
     */
    _formatChartDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString(config.locale, { month: 'short', day: 'numeric' });
    }
    
    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color
     * @param {number} alpha - Alpha value
     * @returns {string} RGBA color
     */
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Truncate query string
     * @param {string} query - Query string
     * @param {number} maxLength - Max length
     * @returns {string} Truncated string
     */
    _truncateQuery(query, maxLength) {
        if (!query) return '';
        if (query.length <= maxLength) return query;
        return query.slice(0, maxLength) + '...';
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

export const dashboardView = new DashboardView();
