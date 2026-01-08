/**
 * CrossAppView.js
 * 
 * View for cross-application analytics.
 * Shows aggregated data from all apps and identifies shared clients.
 */

import { eventBus, Events, state, config } from '../core/index.js';
import { analyticsService } from '../services/index.js';
import { ChartWrapper, formatDate, truncateId, renderBadge } from '../components/index.js';

class CrossAppView {
    constructor() {
        this._container = null;
        this._isInitialized = false;
        
        this._activityChart = null;
        
        this._data = {
            summaries: {},
            clients: {}
        };
        
        this._sharedClients = [];
        this._filteredClients = [];
    }
    
    /**
     * Initialize the cross-app view
     */
    initialize() {
        if (this._isInitialized) return;
        
        this._container = document.getElementById('cross-app-view');
        this._initializeChart();
        this._setupEventListeners();
        this._isInitialized = true;
    }
    
    /**
     * Initialize chart
     */
    _initializeChart() {
        this._activityChart = new ChartWrapper('cross-app-activity-chart', 'bar', {
            showLegend: true,
            legendPosition: 'top'
        });
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Period change
        eventBus.on(Events.PERIOD_CHANGED, () => {
            if (state.currentAppTab === 'cross-app') {
                this.load();
            }
        });
        
        // Refresh
        eventBus.on(Events.REFRESH_TRIGGERED, () => {
            if (state.currentAppTab === 'cross-app') {
                this.load();
            }
        });
        
        // Theme change
        eventBus.on(Events.THEME_CHANGED, () => {
            this._activityChart?.refresh();
        });
        
        // Filter buttons
        const applyBtn = document.getElementById('cross-app-apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._applyFilters());
        }
        
        const resetBtn = document.getElementById('cross-app-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this._resetFilters());
        }
        
        // Search input enter key
        const searchInput = document.getElementById('cross-app-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._applyFilters();
                }
            });
        }
    }
    
    /**
     * Load cross-app data
     */
    async load() {
        state.setLoading('cross-app', true);
        
        const days = state.period;
        
        try {
            // Load summaries from all apps in parallel
            const summariesResult = await analyticsService.getAllDashboardSummaries(days);
            this._data.summaries = summariesResult;
            
            // Load clients from all apps
            const clientsResult = await analyticsService.listClientsFromAllApps({ limit: 200 });
            this._data.clients = clientsResult;
            
            // Process shared clients
            this._processSharedClients();
            
            // Render everything
            this._renderKPIs();
            this._renderActivityChart();
            this._renderSharedClientsTable();
            
            state.setLastUpdate();
        } catch (error) {
            console.error('[CrossAppView] Failed to load data:', error);
        } finally {
            state.setLoading('cross-app', false);
        }
    }
    
    /**
     * Process and identify shared clients across apps
     */
    _processSharedClients() {
        const clientsMap = new Map();
        const apps = config.pfsApps;
        
        // Collect all clients by fingerprint
        apps.forEach(app => {
            const result = this._data.clients[app.id];
            if (!result || !result.success || !result.data?.items) return;
            
            result.data.items.forEach(client => {
                const fingerprint = client.fingerprint;
                if (!fingerprint) return;
                
                if (!clientsMap.has(fingerprint)) {
                    clientsMap.set(fingerprint, {
                        fingerprint,
                        apps: [],
                        totalSessions: 0,
                        totalSearches: 0,
                        totalConversations: 0,
                        firstSeen: null,
                        lastSeen: null
                    });
                }
                
                const entry = clientsMap.get(fingerprint);
                entry.apps.push({
                    appId: app.id,
                    appName: app.name,
                    appColor: app.color,
                    clientId: client.id,
                    sessions: client.session_count || 0,
                    searches: client.total_searches || 0,
                    conversations: client.total_conversations || 0,
                    createdAt: client.created_at,
                    lastSeen: client.last_seen
                });
                
                entry.totalSessions += client.session_count || 0;
                entry.totalSearches += client.total_searches || 0;
                entry.totalConversations += client.total_conversations || 0;
                
                // Track first/last seen
                if (client.created_at) {
                    const created = new Date(client.created_at);
                    if (!entry.firstSeen || created < entry.firstSeen) {
                        entry.firstSeen = created;
                    }
                }
                if (client.last_seen) {
                    const lastSeen = new Date(client.last_seen);
                    if (!entry.lastSeen || lastSeen > entry.lastSeen) {
                        entry.lastSeen = lastSeen;
                    }
                }
            });
        });
        
        // Filter to only clients present in multiple apps
        this._sharedClients = Array.from(clientsMap.values())
            .filter(client => client.apps.length > 1)
            .sort((a, b) => b.apps.length - a.apps.length || b.totalSessions - a.totalSessions);
        
        this._filteredClients = [...this._sharedClients];
    }
    
    /**
     * Render KPI cards
     */
    _renderKPIs() {
        const container = document.getElementById('cross-app-kpi-grid');
        if (!container) return;
        
        const apps = config.pfsApps;
        let totalClients = 0;
        let totalSessions = 0;
        let totalSearches = 0;
        let totalConversations = 0;
        
        // Aggregate data from all apps
        apps.forEach(app => {
            const result = this._data.summaries[app.id];
            if (result && result.success && result.data) {
                totalClients += result.data.total_clients || 0;
                totalSessions += result.data.total_sessions || 0;
                totalSearches += result.data.total_searches || 0;
                totalConversations += result.data.total_conversations || 0;
            }
        });
        
        container.innerHTML = `
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-icon">◈</span>
                </div>
                <div class="kpi-value">${apps.length}</div>
                <div class="kpi-label">Connected Apps</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-icon">◎</span>
                </div>
                <div class="kpi-value">${totalClients.toLocaleString()}</div>
                <div class="kpi-label">Total Clients</div>
                <div class="kpi-sub">${this._sharedClients.length} shared</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-icon">◐</span>
                </div>
                <div class="kpi-value">${totalSessions.toLocaleString()}</div>
                <div class="kpi-label">Total Sessions</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-icon">◑</span>
                </div>
                <div class="kpi-value">${totalSearches.toLocaleString()}</div>
                <div class="kpi-label">Total Searches</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-icon">◒</span>
                </div>
                <div class="kpi-value">${totalConversations.toLocaleString()}</div>
                <div class="kpi-label">Total Conversations</div>
            </div>
        `;
    }
    
    /**
     * Render activity comparison chart
     */
    _renderActivityChart() {
        if (!this._activityChart) return;
        
        const apps = config.pfsApps;
        const labels = apps.map(app => app.name);
        
        const sessionsData = [];
        const searchesData = [];
        const conversationsData = [];
        
        apps.forEach(app => {
            const result = this._data.summaries[app.id];
            if (result && result.success && result.data) {
                sessionsData.push(result.data.total_sessions || 0);
                searchesData.push(result.data.total_searches || 0);
                conversationsData.push(result.data.total_conversations || 0);
            } else {
                sessionsData.push(0);
                searchesData.push(0);
                conversationsData.push(0);
            }
        });
        
        const datasets = [
            {
                label: 'Sessions',
                data: sessionsData,
                backgroundColor: '#6366f1',
                borderRadius: 4
            },
            {
                label: 'Searches',
                data: searchesData,
                backgroundColor: '#22d3ee',
                borderRadius: 4
            },
            {
                label: 'Conversations',
                data: conversationsData,
                backgroundColor: '#a855f7',
                borderRadius: 4
            }
        ];
        
        this._activityChart.setData(labels, datasets);
    }
    
    /**
     * Render shared clients table
     */
    _renderSharedClientsTable() {
        const container = document.getElementById('cross-app-clients-table');
        if (!container) return;
        
        if (this._filteredClients.length === 0) {
            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fingerprint</th>
                            <th>Applications</th>
                            <th>Total Sessions</th>
                            <th>Total Searches</th>
                            <th>Total Conversations</th>
                            <th>First Seen</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="7" class="table-empty">
                                No shared clients found across applications
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
            return;
        }
        
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Fingerprint</th>
                        <th>Applications</th>
                        <th>Total Sessions</th>
                        <th>Total Searches</th>
                        <th>Total Conversations</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    ${this._filteredClients.map(client => `
                        <tr data-fingerprint="${client.fingerprint}" style="cursor: pointer;">
                            <td>
                                <span class="table-id">${client.fingerprint.slice(0, 12)}</span>
                            </td>
                            <td>
                                <div class="shared-client-apps">
                                    ${client.apps.map(app => `
                                        <span class="shared-client-app-badge">
                                            <span class="shared-client-app-dot" style="background: ${app.appColor}"></span>
                                            ${app.appName}
                                        </span>
                                    `).join('')}
                                </div>
                            </td>
                            <td>${client.totalSessions.toLocaleString()}</td>
                            <td>${client.totalSearches.toLocaleString()}</td>
                            <td>${client.totalConversations.toLocaleString()}</td>
                            <td>${client.firstSeen ? formatDate(client.firstSeen.toISOString(), 'medium') : '—'}</td>
                            <td>${client.lastSeen ? formatDate(client.lastSeen.toISOString(), 'medium') : '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Add click handlers for rows
        container.querySelectorAll('tr[data-fingerprint]').forEach(row => {
            row.addEventListener('click', () => {
                const fingerprint = row.dataset.fingerprint;
                const client = this._filteredClients.find(c => c.fingerprint === fingerprint);
                if (client) {
                    this._showClientDetail(client);
                }
            });
        });
    }
    
    /**
     * Show shared client detail modal
     * @param {Object} client - Shared client data
     */
    _showClientDetail(client) {
        const appsHtml = client.apps.map(app => `
            <div class="app-activity-card">
                <div class="app-activity-color" style="background: ${app.appColor}"></div>
                <div class="app-activity-content">
                    <div class="app-activity-name">${app.appName}</div>
                    <div class="app-activity-stats">
                        <div class="app-activity-stat">
                            <span class="app-activity-stat-value">${app.sessions}</span>
                            <span class="app-activity-stat-label">Sessions</span>
                        </div>
                        <div class="app-activity-stat">
                            <span class="app-activity-stat-value">${app.searches}</span>
                            <span class="app-activity-stat-label">Searches</span>
                        </div>
                        <div class="app-activity-stat">
                            <span class="app-activity-stat-value">${app.conversations}</span>
                            <span class="app-activity-stat-label">Conversations</span>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                        Client ID: <span style="font-family: var(--font-mono);">${app.clientId.slice(0, 8)}</span>
                        • Last seen: ${app.lastSeen ? formatDate(app.lastSeen, 'full') : '—'}
                    </div>
                </div>
            </div>
        `).join('');
        
        eventBus.emit(Events.MODAL_OPEN, {
            title: `Shared Client: ${client.fingerprint.slice(0, 12)}...`,
            size: 'large',
            content: `
                <div class="detail-section">
                    <h4 class="detail-title">Client Overview</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Fingerprint</span>
                            <span class="detail-value">${client.fingerprint}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applications Used</span>
                            <span class="detail-value">${client.apps.length}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Sessions</span>
                            <span class="detail-value">${client.totalSessions}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Searches</span>
                            <span class="detail-value">${client.totalSearches}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Conversations</span>
                            <span class="detail-value">${client.totalConversations}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">First Seen</span>
                            <span class="detail-value">${client.firstSeen ? formatDate(client.firstSeen.toISOString(), 'full') : '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Last Seen</span>
                            <span class="detail-value">${client.lastSeen ? formatDate(client.lastSeen.toISOString(), 'full') : '—'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4 class="detail-title">Activity Per Application</h4>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${appsHtml}
                    </div>
                </div>
            `
        });
    }
    
    /**
     * Apply filters
     */
    _applyFilters() {
        const searchValue = document.getElementById('cross-app-search')?.value?.toLowerCase() || '';
        
        if (!searchValue) {
            this._filteredClients = [...this._sharedClients];
        } else {
            this._filteredClients = this._sharedClients.filter(client => 
                client.fingerprint.toLowerCase().includes(searchValue)
            );
        }
        
        this._renderSharedClientsTable();
    }
    
    /**
     * Reset filters
     */
    _resetFilters() {
        const searchInput = document.getElementById('cross-app-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this._filteredClients = [...this._sharedClients];
        this._renderSharedClientsTable();
    }
}

export const crossAppView = new CrossAppView();
