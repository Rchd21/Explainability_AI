/**
 * DataTable.js
 * 
 * Reusable data table component with configurable columns,
 * sorting, and row click handling.
 */

import { config } from '../core/index.js';
import { loader } from './Loader.js';

class DataTable {
    /**
     * Create a DataTable instance
     * @param {string} containerId - Container element ID
     * @param {Object} options - Table options
     */
    constructor(containerId, options = {}) {
        this._container = document.getElementById(containerId);
        this._columns = options.columns || [];
        this._onRowClick = options.onRowClick || null;
        this._emptyMessage = options.emptyMessage || 'No data available';
        this._data = [];
        this._isLoading = false;
    }
    
    /**
     * Set table data and render
     * @param {Array} items - Data items
     */
    setData(items) {
        this._data = items || [];
        this.render();
    }
    
    /**
     * Get current data
     * @returns {Array} Current data
     */
    getData() {
        return this._data;
    }
    
    /**
     * Render the table
     */
    render() {
        if (!this._container) return;
        
        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        ${this._columns.map(col => `
                            <th style="${col.width ? `width: ${col.width}` : ''}">
                                ${col.label}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${this._renderBody()}
                </tbody>
            </table>
        `;
        
        this._container.innerHTML = html;
        
        // Attach row click handlers
        if (this._onRowClick) {
            this._container.querySelectorAll('tbody tr[data-id]').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.dataset.id;
                    const index = parseInt(row.dataset.index, 10);
                    this._onRowClick(this._data[index], id);
                });
            });
        }
    }
    
    /**
     * Render table body
     * @returns {string} HTML string
     */
    _renderBody() {
        if (this._isLoading) {
            return loader.createTableLoading(this._columns.length);
        }
        
        if (this._data.length === 0) {
            return `
                <tr>
                    <td colspan="${this._columns.length}" class="table-empty">
                        ${this._emptyMessage}
                    </td>
                </tr>
            `;
        }
        
        return this._data.map((item, index) => {
            const id = item.id || index;
            return `
                <tr data-id="${id}" data-index="${index}">
                    ${this._columns.map(col => `
                        <td class="${col.className || ''}">
                            ${this._renderCell(item, col)}
                        </td>
                    `).join('')}
                </tr>
            `;
        }).join('');
    }
    
    /**
     * Render a single cell
     * @param {Object} item - Data item
     * @param {Object} col - Column configuration
     * @returns {string} Cell HTML
     */
    _renderCell(item, col) {
        const value = this._getNestedValue(item, col.key);
        
        if (col.render) {
            return col.render(value, item);
        }
        
        if (value === null || value === undefined) {
            return '<span class="text-muted">—</span>';
        }
        
        return this._escapeHtml(String(value));
    }
    
    /**
     * Get nested value from object
     * @param {Object} obj - Object
     * @param {string} path - Dot notation path
     * @returns {*} Value
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }
    
    /**
     * Escape HTML entities
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        this._isLoading = true;
        this.render();
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        this._isLoading = false;
    }
    
    /**
     * Update columns configuration
     * @param {Array} columns - New columns
     */
    setColumns(columns) {
        this._columns = columns;
    }
}

// ============================================================================
// Helper Functions for Cell Rendering
// ============================================================================

/**
 * Format a date value
 * @param {string} value - ISO date string
 * @param {string} format - Format type
 * @returns {string} Formatted date
 */
export function formatDate(value, format = 'full') {
    if (!value) return '—';
    
    const date = new Date(value);
    const options = config.dateFormatOptions[format] || config.dateFormatOptions.full;
    
    return date.toLocaleString(config.locale, options);
}

/**
 * Format a duration in milliseconds
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
    if (!ms && ms !== 0) return '—';
    
    if (ms < 1000) {
        return `${ms}ms`;
    }
    
    const seconds = ms / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    
    const minutes = seconds / 60;
    if (minutes < 60) {
        return `${minutes.toFixed(1)}min`;
    }
    
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
}

/**
 * Format a number with locale
 * @param {number} value - Number to format
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} Formatted number
 */
export function formatNumber(value, options = {}) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat(config.locale, options).format(value);
}

/**
 * Truncate a UUID to first 8 characters
 * @param {string} uuid - UUID string
 * @returns {string} Truncated UUID
 */
export function truncateId(uuid) {
    if (!uuid) return '—';
    return uuid.slice(0, 8);
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 50) {
    if (!text) return '—';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/**
 * Render star rating
 * @param {number} rating - Rating value (1-5)
 * @returns {string} HTML stars
 */
export function renderStars(rating) {
    if (!rating) return '<span class="text-muted">—</span>';
    
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating ? 'filled' : '';
        stars.push(`<span class="star ${filled}">★</span>`);
    }
    
    return `<span class="rating-stars">${stars.join('')}</span>`;
}

/**
 * Render a badge
 * @param {string} text - Badge text
 * @param {string} type - Badge type (success, warning, error, primary)
 * @returns {string} HTML badge
 */
export function renderBadge(text, type = '') {
    const className = type ? `badge badge-${type}` : 'badge';
    return `<span class="${className}">${text}</span>`;
}

/**
 * Render a clickable link
 * @param {string} text - Link text
 * @param {string} className - Additional classes
 * @returns {string} HTML link
 */
export function renderLink(text, className = '') {
    return `<span class="table-link ${className}">${text}</span>`;
}

export { DataTable };
