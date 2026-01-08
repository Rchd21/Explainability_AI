/**
 * Pagination.js
 * 
 * Reusable pagination component with page numbers and navigation.
 */

class Pagination {
    /**
     * Create a Pagination instance
     * @param {string} containerId - Container element ID
     * @param {Object} options - Pagination options
     */
    constructor(containerId, options = {}) {
        this._container = document.getElementById(containerId);
        this._onPageChange = options.onPageChange || null;
        this._maxVisiblePages = options.maxVisiblePages || 5;
        
        this._currentPage = 1;
        this._totalPages = 1;
        this._total = 0;
        this._limit = 50;
        this._offset = 0;
    }
    
    /**
     * Update pagination state
     * @param {number} total - Total items
     * @param {number} limit - Items per page
     * @param {number} offset - Current offset
     */
    update(total, limit, offset) {
        this._total = total;
        this._limit = limit;
        this._offset = offset;
        this._totalPages = Math.ceil(total / limit);
        this._currentPage = Math.floor(offset / limit) + 1;
        
        this.render();
    }
    
    /**
     * Render the pagination
     */
    render() {
        if (!this._container) return;
        
        const startItem = this._offset + 1;
        const endItem = Math.min(this._offset + this._limit, this._total);
        
        this._container.innerHTML = `
            <div class="pagination-info">
                ${this._total > 0 
                    ? `Showing ${startItem}-${endItem} of ${this._total.toLocaleString()}`
                    : 'No results'
                }
            </div>
            <div class="pagination-controls">
                ${this._renderControls()}
            </div>
        `;
        
        this._attachEventListeners();
    }
    
    /**
     * Render pagination controls
     * @returns {string} HTML string
     */
    _renderControls() {
        if (this._totalPages <= 1) {
            return '';
        }
        
        const pages = this._getVisiblePages();
        
        let html = `
            <button class="pagination-btn" data-page="prev" ${this._currentPage === 1 ? 'disabled' : ''}>
                ‹
            </button>
        `;
        
        pages.forEach(page => {
            if (page === '...') {
                html += `<span class="pagination-btn" style="cursor: default">...</span>`;
            } else {
                const isActive = page === this._currentPage;
                html += `
                    <button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${page}">
                        ${page}
                    </button>
                `;
            }
        });
        
        html += `
            <button class="pagination-btn" data-page="next" ${this._currentPage === this._totalPages ? 'disabled' : ''}>
                ›
            </button>
        `;
        
        return html;
    }
    
    /**
     * Get visible page numbers
     * @returns {Array} Page numbers to display
     */
    _getVisiblePages() {
        const pages = [];
        const total = this._totalPages;
        const current = this._currentPage;
        const maxVisible = this._maxVisiblePages;
        
        if (total <= maxVisible + 2) {
            // Show all pages
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);
            
            // Calculate range around current page
            let start = Math.max(2, current - Math.floor(maxVisible / 2));
            let end = Math.min(total - 1, start + maxVisible - 1);
            
            // Adjust start if end is at max
            if (end === total - 1) {
                start = Math.max(2, end - maxVisible + 1);
            }
            
            // Add ellipsis if needed
            if (start > 2) {
                pages.push('...');
            }
            
            // Add middle pages
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            // Add ellipsis if needed
            if (end < total - 1) {
                pages.push('...');
            }
            
            // Always show last page
            pages.push(total);
        }
        
        return pages;
    }
    
    /**
     * Attach event listeners to pagination buttons
     */
    _attachEventListeners() {
        if (!this._container) return;
        
        this._container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this._handlePageClick(page);
            });
        });
    }
    
    /**
     * Handle page button click
     * @param {string} page - Page number or 'prev'/'next'
     */
    _handlePageClick(page) {
        let newPage;
        
        if (page === 'prev') {
            newPage = Math.max(1, this._currentPage - 1);
        } else if (page === 'next') {
            newPage = Math.min(this._totalPages, this._currentPage + 1);
        } else {
            newPage = parseInt(page, 10);
        }
        
        if (newPage !== this._currentPage && this._onPageChange) {
            const newOffset = (newPage - 1) * this._limit;
            this._onPageChange(newPage, newOffset);
        }
    }
    
    /**
     * Go to specific page
     * @param {number} page - Page number
     */
    goToPage(page) {
        if (page >= 1 && page <= this._totalPages && page !== this._currentPage) {
            const newOffset = (page - 1) * this._limit;
            this._currentPage = page;
            this._offset = newOffset;
            this.render();
            
            if (this._onPageChange) {
                this._onPageChange(page, newOffset);
            }
        }
    }
    
    /**
     * Get current page
     * @returns {number} Current page number
     */
    getCurrentPage() {
        return this._currentPage;
    }
    
    /**
     * Get total pages
     * @returns {number} Total pages
     */
    getTotalPages() {
        return this._totalPages;
    }
    
    /**
     * Reset pagination
     */
    reset() {
        this._currentPage = 1;
        this._offset = 0;
        this._total = 0;
        this._totalPages = 1;
        this.render();
    }
}

export { Pagination };
