/**
 * DetailRenderers.js
 * 
 * Rendering components for conversation, search, and context details.
 */

import { formatDate, formatDuration, truncateText, truncateId } from './DataTable.js';

// ============================================================================
// CONVERSATION DETAIL
// ============================================================================

export function renderConversationDetail(conversation, appId) {
    const contextItems = conversation.context || [];
    const hasContext = contextItems.length > 0;
    
    const groupedContext = groupContextByDocument(contextItems);
    const uniqueDocs = Object.keys(groupedContext).length;
    const totalPages = contextItems.length;
    
    return `
        <div class="conversation-detail" data-app-id="${appId || ''}">
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">❓</span> Question</h4>
                <div class="conversation-question-box">${escapeHtml(conversation.question)}</div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">💬</span> Response</h4>
                <div class="conversation-response-box">${formatMarkdown(conversation.response || 'No response')}</div>
            </div>
            
            ${hasContext ? `
                <div class="detail-section">
                    <h4 class="detail-title">
                        <span class="detail-icon">📚</span> Context Used
                        <span class="context-stats-badge">${totalPages} page${totalPages > 1 ? 's' : ''} from ${uniqueDocs} document${uniqueDocs > 1 ? 's' : ''}</span>
                    </h4>
                    <div class="context-documents-grid" data-app-id="${appId || ''}">
                        ${renderContextDocumentCards(groupedContext, appId)}
                    </div>
                </div>
            ` : ''}
            
            ${conversation.rating ? `
                <div class="detail-section">
                    <h4 class="detail-title"><span class="detail-icon">⭐</span> User Rating</h4>
                    <div class="rating-display">
                        <div class="rating-stars-large">
                            ${renderStarsHtml(conversation.rating)}
                            <span class="rating-value">${conversation.rating}/5</span>
                        </div>
                        ${conversation.rating_comment ? `
                            <div class="rating-comment-box">
                                <span class="quote-mark">"</span>${escapeHtml(conversation.rating_comment)}<span class="quote-mark">"</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">⚙️</span> Technical Details</h4>
                <div class="technical-grid">
                    <div class="tech-item">
                        <span class="tech-label">Response Time</span>
                        <span class="tech-value">${formatDuration(conversation.response_time_ms)}</span>
                    </div>
                    <div class="tech-item">
                        <span class="tech-label">Tokens</span>
                        <span class="tech-value">${conversation.tokens_used?.toLocaleString() || '—'}</span>
                    </div>
                    <div class="tech-item">
                        <span class="tech-label">Model</span>
                        <span class="tech-value model-badge">${conversation.model_name || '—'}</span>
                    </div>
                    <div class="tech-item">
                        <span class="tech-label">Created</span>
                        <span class="tech-value">${formatDate(conversation.created_at, 'full')}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">🔗</span> Identifiers</h4>
                <div class="ids-grid">
                    <div class="id-item">
                        <span class="id-label">Conversation ID</span>
                        <span class="id-value">${conversation.id}</span>
                    </div>
                    <div class="id-item">
                        <span class="id-label">Session ID</span>
                        <span class="id-value clickable-id" data-type="session" data-id="${conversation.session_id}" data-app-id="${appId || ''}">${conversation.session_id}</span>
                    </div>
                    <div class="id-item">
                        <span class="id-label">Client ID</span>
                        <span class="id-value clickable-id" data-type="client" data-id="${conversation.client_id}" data-app-id="${appId || ''}">${conversation.client_id}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function groupContextByDocument(contextItems) {
    const grouped = {};
    
    contextItems.forEach((ctx, index) => {
        const docId = ctx.document_id || `doc_${index}`;
        const docTitle = ctx.title || ctx.document_id || 'Unknown Document';
        
        if (!grouped[docId]) {
            grouped[docId] = {
                id: docId,
                title: docTitle,
                pages: [],
                maxScore: 0,
                metadata: ctx.metadata || {}
            };
        }
        
        grouped[docId].pages.push({
            page: ctx.page,
            page_number: ctx.page,
            score: ctx.score || 0,
            text: ctx.snippet || ctx.text || '',
            have_text: !!(ctx.snippet || ctx.text)
        });
        
        if ((ctx.score || 0) > grouped[docId].maxScore) {
            grouped[docId].maxScore = ctx.score || 0;
        }
    });
    
    Object.values(grouped).forEach(doc => {
        doc.pages.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.page || 0) - (b.page || 0);
        });
        doc.bestPage = doc.pages[0];
    });
    
    return grouped;
}

function renderContextDocumentCards(groupedContext, appId) {
    const documents = Object.values(groupedContext);
    documents.sort((a, b) => b.maxScore - a.maxScore);
    
    return documents.map(doc => {
        const bestPage = doc.bestPage;
        const scorePercent = Math.round((bestPage?.score || 0) * 100);
        const pageNum = bestPage?.page || 1;
        
        return `
            <div class="context-doc-card" data-doc-id="${doc.id}" data-app-id="${appId || ''}" data-best-page="${pageNum}">
                <div class="context-doc-preview" data-doc-id="${doc.id}" data-page="${pageNum}" data-app-id="${appId || ''}">
                    <div class="preview-placeholder">
                        <div class="spinner-sm"></div>
                    </div>
                    ${scorePercent > 0 ? `<span class="preview-score-badge">${scorePercent}%</span>` : ''}
                    <span class="preview-page-badge">${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}</span>
                </div>
                <div class="context-doc-info">
                    <h4 class="context-doc-title">${escapeHtml(truncateText(doc.title, 50))}</h4>
                    <span class="context-doc-meta">Best: Page ${pageNum}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// CONTEXT DOCUMENT OVERLAY
// ============================================================================

export function renderContextDocumentOverlay(doc, appId, cardConfig = []) {
    const metadataHtml = renderDocumentMetadata(doc.metadata || {}, cardConfig);
    const pagesHtml = doc.pages.map(page => renderPageCard(doc.id, page, appId)).join('');
    
    return `
        <div class="context-overlay-wrapper" data-app-id="${appId || ''}" data-doc-id="${doc.id}">
            <div class="overlay-doc-header">
                <div class="overlay-doc-title">
                    <span class="doc-icon">📄</span>
                    <span>${escapeHtml(doc.title)}</span>
                </div>
                <span class="overlay-doc-stats">${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''} in context</span>
            </div>
            
            ${metadataHtml ? `
                <div class="overlay-metadata-section">
                    ${metadataHtml}
                </div>
            ` : ''}
            
            <div class="overlay-pages-section">
                <h4 class="pages-section-title">Pages</h4>
                <div class="overlay-pages-grid" data-app-id="${appId || ''}" data-doc-id="${doc.id}">
                    ${pagesHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render document metadata using cardConfig
 */
function renderDocumentMetadata(metadata, cardConfig = []) {
    if (!metadata || Object.keys(metadata).length === 0) return '';
    
    // If no cardConfig, use raw metadata
    if (!cardConfig || cardConfig.length === 0) {
        const entries = Object.entries(metadata).filter(([k, v]) => 
            v !== null && v !== undefined && v !== '' && k !== 'pages_count'
        );
        if (entries.length === 0) return '';
        
        return `
            <div class="metadata-list">
                ${entries.slice(0, 10).map(([key, value]) => {
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return renderMetadataField({ field: key, label, type: 'text' }, value);
                }).join('')}
            </div>
        `;
    }
    
    // Sort by position
    const sortedConfig = [...cardConfig].sort((a, b) => (a.position || 0) - (b.position || 0));
    
    const fields = sortedConfig
        .filter(cfg => {
            const val = metadata[cfg.field];
            return val !== null && val !== undefined && val !== '';
        })
        .map(cfg => renderMetadataField(cfg, metadata[cfg.field]));
    
    if (fields.length === 0) return '';
    
    return `<div class="metadata-list">${fields.join('')}</div>`;
}

/**
 * Render a single metadata field based on its type
 */
function renderMetadataField(fieldConfig, value) {
    const { field, label, type } = fieldConfig;
    
    switch (type) {
        case 'tag':
            const tagValues = Array.isArray(value) ? value : [value];
            const tags = tagValues.slice(0, 8).map(v => 
                `<span class="metadata-tag">${escapeHtml(String(v))}</span>`
            ).join('');
            const moreTags = tagValues.length > 8 ? `<span class="metadata-tag metadata-tag-more">+${tagValues.length - 8}</span>` : '';
            return `
                <div class="metadata-row">
                    <span class="metadata-label">${escapeHtml(label)}</span>
                    <div class="metadata-tags">${tags}${moreTags}</div>
                </div>
            `;
            
        case 'link':
            return `
                <div class="metadata-row">
                    <span class="metadata-label">${escapeHtml(label)}</span>
                    <a href="${escapeHtml(String(value))}" target="_blank" class="metadata-link" onclick="event.stopPropagation();">
                        Open ↗
                    </a>
                </div>
            `;
        
        case 'html':
            const htmlContent = String(value);
            const needsExpander = htmlContent.length > 150;
            const htmlId = `html-${field}-${Math.random().toString(36).substr(2, 9)}`;
            return `
                <div class="metadata-row metadata-row-full">
                    <span class="metadata-label">${escapeHtml(label)}</span>
                    <div class="metadata-content">
                        <div class="metadata-html ${needsExpander ? 'collapsed' : ''}" id="${htmlId}">${htmlContent}</div>
                        ${needsExpander ? `
                            <button class="metadata-expander" onclick="event.stopPropagation(); this.previousElementSibling.classList.toggle('collapsed'); this.textContent = this.previousElementSibling.classList.contains('collapsed') ? 'Show more ▼' : 'Show less ▲';">
                                Show more ▼
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
        default: // text
            const textValue = Array.isArray(value) ? value.join(', ') : String(value);
            const textNeedsExpander = textValue.length > 150;
            
            if (textNeedsExpander) {
                const textId = `text-${field}-${Math.random().toString(36).substr(2, 9)}`;
                return `
                    <div class="metadata-row metadata-row-full">
                        <span class="metadata-label">${escapeHtml(label)}</span>
                        <div class="metadata-content">
                            <div class="metadata-text collapsed" id="${textId}">${escapeHtml(textValue)}</div>
                            <button class="metadata-expander" onclick="event.stopPropagation(); this.previousElementSibling.classList.toggle('collapsed'); this.textContent = this.previousElementSibling.classList.contains('collapsed') ? 'Show more ▼' : 'Show less ▲';">
                                Show more ▼
                            </button>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="metadata-row">
                    <span class="metadata-label">${escapeHtml(label)}</span>
                    <span class="metadata-value">${escapeHtml(textValue)}</span>
                </div>
            `;
    }
}

function renderPageCard(docId, page, appId) {
    const scorePercent = Math.round((page.score || 0) * 100);
    const pageNum = page.page || page.page_number || 1;
    const hasText = page.have_text && page.text;
    
    return `
        <div class="overlay-page-card">
            <div class="page-preview-wrapper">
                <div class="page-preview-container" data-doc-id="${docId}" data-page="${pageNum}" data-app-id="${appId || ''}">
                    <div class="preview-placeholder">
                        <div class="spinner-sm"></div>
                    </div>
                </div>
                <div class="page-badges">
                    <span class="page-num-badge">Page ${pageNum}</span>
                    ${scorePercent > 0 ? `<span class="page-score-badge">${scorePercent}%</span>` : ''}
                </div>
            </div>
            ${hasText ? `
                <div class="page-text-expander">
                    <button class="text-toggle-btn" onclick="this.closest('.overlay-page-card').classList.toggle('expanded')">
                        <span>📝 View extracted text</span>
                        <span class="toggle-chevron">▼</span>
                    </button>
                    <div class="page-text-box">${escapeHtml(page.text)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================================
// SEARCH DETAIL
// ============================================================================

export function renderSearchDetail(search, appId) {
    const hasFilters = search.filters && search.filters.length > 0;
    const hasQuery = search.query && search.query.trim().length > 0;
    
    return `
        <div class="search-detail" data-app-id="${appId || ''}">
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">🔍</span> Search Query</h4>
                ${hasQuery ? `
                    <div class="search-query-box">${escapeHtml(search.query)}</div>
                ` : `
                    <div class="search-query-empty">
                        <span class="empty-icon">∅</span> No text query — browse mode
                    </div>
                `}
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title">
                    <span class="detail-icon">🏷️</span> Filters
                    ${hasFilters ? `<span class="filter-count-badge">${search.filters.length}</span>` : ''}
                </h4>
                ${hasFilters ? `
                    <div class="filters-display">${search.filters.map(f => renderFilterBadge(f)).join('')}</div>
                ` : `<p class="text-muted">No filters applied</p>`}
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">📊</span> Results</h4>
                <div class="results-stats">
                    <div class="result-stat result-stat-primary">
                        <span class="result-stat-value">${search.results_count?.toLocaleString() || 0}</span>
                        <span class="result-stat-label">Documents</span>
                    </div>
                    <div class="result-stat">
                        <span class="result-stat-value">${formatDuration(search.duration_ms)}</span>
                        <span class="result-stat-label">Duration</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">📋</span> Metadata</h4>
                <div class="ids-grid">
                    <div class="id-item">
                        <span class="id-label">Search ID</span>
                        <span class="id-value">${search.id}</span>
                    </div>
                    <div class="id-item">
                        <span class="id-label">Session ID</span>
                        <span class="id-value clickable-id" data-type="session" data-id="${search.session_id}" data-app-id="${appId || ''}">${search.session_id}</span>
                    </div>
                    <div class="id-item">
                        <span class="id-label">Client ID</span>
                        <span class="id-value clickable-id" data-type="client" data-id="${search.client_id}" data-app-id="${appId || ''}">${search.client_id}</span>
                    </div>
                    <div class="id-item">
                        <span class="id-label">Strategy</span>
                        <span class="id-value strategy-badge ${search.score_strategy || 'hybrid'}">${search.score_strategy || 'hybrid'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderFilterBadge(filter) {
    let valueDisplay = '';
    let typeIcon = '☑';
    
    if (filter.values) {
        valueDisplay = filter.values.slice(0, 3).map(v => `<span class="filter-val">${escapeHtml(v)}</span>`).join('');
        if (filter.values.length > 3) valueDisplay += `<span class="filter-val">+${filter.values.length - 3}</span>`;
    } else if (filter.nodes) {
        typeIcon = '🌳';
        valueDisplay = filter.nodes.slice(0, 2).map(n => `<span class="filter-val">${escapeHtml(n)}</span>`).join('');
    } else if (filter.date_min !== undefined || filter.date_max !== undefined) {
        typeIcon = '📅';
        const min = filter.date_min ? new Date(filter.date_min * 1000).toLocaleDateString() : '...';
        const max = filter.date_max ? new Date(filter.date_max * 1000).toLocaleDateString() : '...';
        valueDisplay = `<span class="filter-val">${min} → ${max}</span>`;
    }
    
    return `<div class="filter-badge"><span class="filter-icon">${typeIcon}</span><span class="filter-field">${escapeHtml(filter.field)}</span>${valueDisplay}</div>`;
}

// ============================================================================
// FEEDBACK DETAIL
// ============================================================================

export function renderFeedbackDetail(feedback, appId) {
    return `
        <div class="feedback-detail" data-app-id="${appId || ''}">
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">❓</span> Question</h4>
                <div class="conversation-question-box">${escapeHtml(feedback.question)}</div>
            </div>
            
            ${feedback.response ? `
                <div class="detail-section">
                    <h4 class="detail-title"><span class="detail-icon">💬</span> Response</h4>
                    <div class="conversation-response-box">${formatMarkdown(feedback.response)}</div>
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">⭐</span> Rating</h4>
                <div class="rating-display">
                    <div class="rating-stars-large">
                        ${renderStarsHtml(feedback.rating)}
                        <span class="rating-value">${feedback.rating}/5</span>
                    </div>
                    ${feedback.rating_comment ? `
                        <div class="rating-comment-box">"${escapeHtml(feedback.rating_comment)}"</div>
                    ` : ''}
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-title"><span class="detail-icon">🔗</span> Related</h4>
                <div class="related-links">
                    <button class="related-link-btn" data-type="session" data-id="${feedback.session_id}" data-app-id="${appId || ''}">
                        📋 View Session
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// TIMELINE
// ============================================================================

export function renderConversationPreview(conversation) {
    const contextCount = (conversation.context || []).length;
    const uniqueDocs = new Set((conversation.context || []).map(c => c.document_id || c.title)).size;
    const question = conversation.question || conversation.content || '';
    
    return `
        <div class="conversation-preview">
            <div class="preview-question">
                <span class="preview-icon">❓</span>
                <span class="preview-text">${escapeHtml(truncateText(question, 100))}</span>
            </div>
            <div class="preview-meta">
                ${conversation.rating ? `<span class="preview-rating">${renderStarsHtml(conversation.rating, 'small')}</span>` : ''}
                ${contextCount > 0 ? `<span class="preview-context">📚 ${contextCount}p (${uniqueDocs} docs)</span>` : ''}
                <span class="preview-time">${formatDuration(conversation.response_time_ms)}</span>
            </div>
        </div>
    `;
}

export function renderSearchPreview(search) {
    const query = search.query || search.content || '';
    const hasQuery = query && query.trim().length > 0;
    const filterCount = (search.filters || []).length;
    
    return `
        <div class="search-preview">
            <div class="preview-query">
                <span class="preview-icon">🔍</span>
                <span class="preview-text">${hasQuery ? escapeHtml(truncateText(query, 80)) : '<em>Browse mode</em>'}</span>
            </div>
            <div class="preview-meta">
                <span class="preview-results">${search.results_count?.toLocaleString() || 0} results</span>
                ${filterCount > 0 ? `<span class="preview-filters">🏷️ ${filterCount}</span>` : ''}
                <span class="preview-time">${formatDuration(search.duration_ms)}</span>
            </div>
        </div>
    `;
}

export function renderEnhancedTimeline(items) {
    if (!items || items.length === 0) {
        return '<p class="text-muted">No activity recorded</p>';
    }
    
    return `
        <div class="enhanced-timeline">
            ${items.map((item, index) => {
                const isSearch = item.type === 'search';
                const isConversation = item.type === 'conversation';
                
                return `
                    <div class="timeline-item-enhanced ${item.type}" data-index="${index}" data-type="${item.type}" data-id="${item.id || ''}">
                        <div class="timeline-connector">
                            <div class="timeline-dot-enhanced ${item.type}"></div>
                            ${index < items.length - 1 ? '<div class="timeline-line"></div>' : ''}
                        </div>
                        <div class="timeline-content-enhanced">
                            <div class="timeline-header">
                                <span class="timeline-type-badge ${item.type}">${item.type}</span>
                                <span class="timeline-time">${formatDate(item.created_at, 'time')}</span>
                            </div>
                            ${isSearch ? renderSearchPreview(item) : ''}
                            ${isConversation ? renderConversationPreview(item) : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================================================
// HELPERS
// ============================================================================

export function renderStarsHtml(rating, size = 'medium') {
    if (!rating) return '<span class="text-muted">—</span>';
    let html = `<span class="stars stars-${size}">`;
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
    }
    return html + '</span>';
}

export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function formatMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

export function renderContextSummary(context) {
    if (!context || context.length === 0) return '<span class="text-muted">—</span>';
    const uniqueDocs = new Set(context.map(c => c.document_id || c.title)).size;
    return `<span class="context-summary-badge">📚 ${context.length}p (${uniqueDocs} docs)</span>`;
}
