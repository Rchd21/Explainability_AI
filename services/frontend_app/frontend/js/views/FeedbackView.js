/**
 * FeedbackView.js
 * 
 * View for analyzing feedback and ratings.
 * Displays rating distribution, statistics, and recent feedback.
 */

import { eventBus, Events, state, config } from '../core/index.js';
import { analyticsService } from '../services/index.js';
import { createRatingChart, formatDate, truncateText } from '../components/index.js';

class FeedbackView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._ratingChart = null;
        
        this._data = {
            distribution: null,
            feedback: null,
            summary: null
        };
        
        this._filters = {
            rating: '',
            hasComment: ''
        };
    }
    
    /**
     * Initialize the feedback view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('feedback-view');
        this._initializeChart();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize chart
     */
    _initializeChart() {
        this._ratingChart = createRatingChart('feedback-rating-chart');
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Filter changes
        const ratingFilter = document.getElementById('feedback-rating-filter');
        if (ratingFilter) {
            ratingFilter.addEventListener('change', () => this._applyFilters());
        }
        
        const commentFilter = document.getElementById('feedback-comment-filter');
        if (commentFilter) {
            commentFilter.addEventListener('change', () => this._applyFilters());
        }
        
        // Refresh triggers
        eventBus.on(Events.PERIOD_CHANGED, () => {
            if (state.currentView === 'feedback') {
                this.load();
            }
        });
        
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentView === 'feedback') {
                this.load();
            }
        });
        
        // Theme change
        eventBus.on(Events.THEME_CHANGED, () => {
            this._ratingChart?.refresh();
        });
    }
    
    /**
     * Load feedback data
     */
    async load() {
        state.setLoading('feedback', true);
        
        try {
            const [distribution, feedback, summary] = await Promise.all([
                analyticsService.getRatingDistribution(),
                analyticsService.getRecentFeedback(100),
                analyticsService.getDashboardSummary(state.period)
            ]);
            
            this._data = { distribution, feedback, summary };
            
            this._renderStats();
            this._renderChart();
            this._renderFeedbackList();
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[FeedbackView] Failed to load data:', error);
        } finally {
            state.setLoading('feedback', false);
        }
    }
    
    /**
     * Render statistics cards
     */
    _renderStats() {
        const { summary, distribution, feedback } = this._data;
        
        // Average rating
        const avgRatingEl = document.getElementById('feedback-avg-rating');
        const avgStarsEl = document.getElementById('feedback-avg-stars');
        if (avgRatingEl && summary) {
            avgRatingEl.textContent = summary.avg_rating ? summary.avg_rating.toFixed(2) : '—';
            if (avgStarsEl) {
                avgStarsEl.innerHTML = this._renderStarsHtml(Math.round(summary.avg_rating || 0));
            }
        }
        
        // Total rated
        const totalRatedEl = document.getElementById('feedback-total-rated');
        if (totalRatedEl && summary) {
            totalRatedEl.textContent = summary.rated_conversations?.toLocaleString() || '0';
        }
        
        // With comments
        const withCommentsEl = document.getElementById('feedback-with-comments');
        if (withCommentsEl && feedback) {
            const withComments = feedback.filter(f => f.rating_comment).length;
            withCommentsEl.textContent = withComments.toLocaleString();
        }
    }
    
    /**
     * Render rating distribution chart
     */
    _renderChart() {
        const { distribution } = this._data;
        if (!distribution || !this._ratingChart) return;
        
        const labels = distribution.map(r => `${r.rating} ★`);
        
        const datasets = [{
            data: distribution.map(r => r.count),
            backgroundColor: [
                '#ef4444',  // 1 star
                '#f59e0b',  // 2 stars
                '#eab308',  // 3 stars
                '#22c55e',  // 4 stars
                '#10b981'   // 5 stars
            ],
            borderRadius: 4
        }];
        
        this._ratingChart.setData(labels, datasets);
    }
    
    /**
     * Render feedback list
     */
    _renderFeedbackList() {
        const container = document.getElementById('feedback-list');
        if (!container) return;
        
        let { feedback } = this._data;
        if (!feedback || feedback.length === 0) {
            container.innerHTML = `
                <div class="feedback-item">
                    <p style="color: var(--text-muted); text-align: center; padding: 2rem;">
                        No feedback available
                    </p>
                </div>
            `;
            return;
        }
        
        // Apply filters
        feedback = this._filterFeedback(feedback);
        
        if (feedback.length === 0) {
            container.innerHTML = `
                <div class="feedback-item">
                    <p style="color: var(--text-muted); text-align: center; padding: 2rem;">
                        No feedback matches the selected filters
                    </p>
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
                const feedbackItem = this._data.feedback.find(f => f.id === id);
                if (feedbackItem) {
                    this._showFeedbackDetail(feedbackItem);
                }
            });
        });
    }
    
    /**
     * Filter feedback based on current filters
     * @param {Array} feedback - Feedback items
     * @returns {Array} Filtered items
     */
    _filterFeedback(feedback) {
        return feedback.filter(item => {
            // Rating filter
            if (this._filters.rating === 'low' && item.rating > 2) return false;
            if (this._filters.rating === 'medium' && item.rating !== 3) return false;
            if (this._filters.rating === 'high' && item.rating < 4) return false;
            
            // Comment filter
            if (this._filters.hasComment === 'true' && !item.rating_comment) return false;
            
            return true;
        });
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        this._filters.rating = document.getElementById('feedback-rating-filter')?.value || '';
        this._filters.hasComment = document.getElementById('feedback-comment-filter')?.value || '';
        
        this._renderFeedbackList();
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
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                        <div style="font-size: 1.5rem;">${this._renderStarsHtml(item.rating)}</div>
                        <span style="font-size: 1.5rem; font-weight: 600;">${item.rating}/5</span>
                    </div>
                    ${item.rating_comment ? `
                        <div class="detail-content" style="font-style: italic;">
                            "${this._escapeHtml(item.rating_comment)}"
                        </div>
                    ` : '<p style="color: var(--text-muted);">No comment provided</p>'}
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Question</h4>
                    <div class="detail-content">${this._escapeHtml(item.question)}</div>
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Response</h4>
                    <div class="detail-content" style="max-height: 250px; overflow-y: auto;">
                        ${this._escapeHtml(item.response)}
                    </div>
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
                            <span class="detail-label">Client ID</span>
                            <span class="detail-value">${item.client_id?.slice(0, 8) || '—'}</span>
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

export const feedbackView = new FeedbackView();
