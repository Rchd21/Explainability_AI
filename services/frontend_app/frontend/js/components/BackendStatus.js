/**
 * BackendStatus.js
 * 
 * Component for displaying and monitoring backend service health status.
 * Pings detector backends periodically and shows UP/DOWN status with animations.
 */

import { config } from '../core/Config.js';
import { apiService } from '../core/ApiService.js';
import { eventBus, Events } from '../core/EventBus.js';

class BackendStatus {
    constructor() {
        this._container = null;
        this._statusElements = new Map();
        this._intervalId = null;
        this._statuses = new Map();
        
        // Initialize status for all detectors
        Object.keys(config.detectors).forEach(key => {
            this._statuses.set(key, {
                isUp: null, // null = unknown, true = up, false = down
                latency: null,
                lastCheck: null,
                error: null
            });
        });
    }

    /**
     * Initialize the backend status component
     */
    initialize() {
        this._container = document.getElementById('backend-status-container');
        
        if (!this._container) {
            console.warn('[BackendStatus] Container not found');
            return;
        }

        this._renderStatusCards();
        this._startPingLoop();
        
        console.log('[BackendStatus] Initialized');
    }

    /**
     * Render status cards for all backends
     */
    _renderStatusCards() {
        const detectors = config.detectors;
        
        let html = `
            <div class="backend-status-header">
                <h3 class="status-title">
                    <span class="status-icon">🖥️</span>
                    Backend Services
                </h3>
            </div>
            <div class="backend-status-grid">
        `;

        Object.entries(detectors).forEach(([key, detector]) => {
            html += `
                <div class="backend-status-card" data-detector="${key}">
                    <div class="status-indicator-wrapper">
                        <div class="status-indicator unknown" id="status-indicator-${key}">
                            <div class="status-dot"></div>
                            <div class="status-pulse"></div>
                            <div class="status-ping"></div>
                        </div>
                    </div>
                    <div class="status-info">
                        <span class="status-name">${detector.displayName}</span>
                        <span class="status-label" id="status-label-${key}">Checking...</span>
                    </div>
                    <div class="status-latency" id="status-latency-${key}">--</div>
                </div>
            `;
        });

        html += '</div>';
        this._container.innerHTML = html;

        // Cache status elements
        Object.keys(detectors).forEach(key => {
            this._statusElements.set(key, {
                indicator: document.getElementById(`status-indicator-${key}`),
                label: document.getElementById(`status-label-${key}`),
                latency: document.getElementById(`status-latency-${key}`)
            });
        });
    }

    /**
     * Start the periodic ping loop
     */
    _startPingLoop() {
        // Perform initial ping
        this._pingAllBackends();

        // Set up interval for subsequent pings
        this._intervalId = setInterval(() => {
            this._pingAllBackends();
        }, config.settings.pingInterval);
    }

    /**
     * Stop the ping loop
     */
    stopPingLoop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Ping all backend services
     */
    async _pingAllBackends() {
        const detectorKeys = Object.keys(config.detectors);
        
        // Emit ping sent event for animations
        eventBus.emit(Events.BACKEND_PING_SENT, {});
        
        // Trigger ping animation on all indicators
        this._statusElements.forEach((elements) => {
            elements.indicator?.classList.add('pinging');
            setTimeout(() => {
                elements.indicator?.classList.remove('pinging');
            }, 300);
        });

        // Ping all backends in parallel
        const pingPromises = detectorKeys.map(key => this._pingBackend(key));
        await Promise.all(pingPromises);
    }

    /**
     * Ping a single backend service
     * @param {string} detectorKey - Detector key
     */
    async _pingBackend(detectorKey) {
        try {
            const result = await apiService.pingDetector(detectorKey);
            
            this._updateStatus(detectorKey, {
                isUp: result.success,
                latency: result.latency,
                lastCheck: new Date(),
                error: result.error || null
            });
        } catch (error) {
            this._updateStatus(detectorKey, {
                isUp: false,
                latency: null,
                lastCheck: new Date(),
                error: error.message
            });
        }
    }

    /**
     * Update status for a detector
     * @param {string} detectorKey - Detector key
     * @param {Object} status - Status object
     */
    _updateStatus(detectorKey, status) {
        const previousStatus = this._statuses.get(detectorKey);
        this._statuses.set(detectorKey, status);

        // Update UI
        this._updateStatusUI(detectorKey, status);

        // Emit event if status changed
        if (previousStatus?.isUp !== status.isUp) {
            eventBus.emit(Events.BACKEND_STATUS_CHANGED, {
                detectorKey,
                isUp: status.isUp,
                latency: status.latency
            });
        }
    }

    /**
     * Update status UI for a detector
     * @param {string} detectorKey - Detector key
     * @param {Object} status - Status object
     */
    _updateStatusUI(detectorKey, status) {
        const elements = this._statusElements.get(detectorKey);
        if (!elements) return;

        const { indicator, label, latency } = elements;

        // Update indicator class
        if (indicator) {
            indicator.classList.remove('unknown', 'up', 'down');
            if (status.isUp === null) {
                indicator.classList.add('unknown');
            } else if (status.isUp) {
                indicator.classList.add('up');
            } else {
                indicator.classList.add('down');
            }
        }

        // Update label
        if (label) {
            if (status.isUp === null) {
                label.textContent = 'Checking...';
                label.className = 'status-label';
            } else if (status.isUp) {
                label.textContent = 'Online';
                label.className = 'status-label up';
            } else {
                label.textContent = 'Offline';
                label.className = 'status-label down';
            }
        }

        // Update latency
        if (latency) {
            if (status.latency !== null && status.isUp) {
                latency.textContent = `${status.latency}ms`;
                latency.className = 'status-latency visible';
            } else {
                latency.textContent = '--';
                latency.className = 'status-latency';
            }
        }
    }

    /**
     * Get status for a detector
     * @param {string} detectorKey - Detector key
     * @returns {Object} Status object
     */
    getStatus(detectorKey) {
        return this._statuses.get(detectorKey);
    }

    /**
     * Check if a detector is up
     * @param {string} detectorKey - Detector key
     * @returns {boolean} True if up
     */
    isUp(detectorKey) {
        const status = this._statuses.get(detectorKey);
        return status?.isUp === true;
    }

    /**
     * Force an immediate ping of all backends
     */
    async refreshStatus() {
        await this._pingAllBackends();
    }

    /**
     * Destroy the component
     */
    destroy() {
        this.stopPingLoop();
        this._statusElements.clear();
        this._statuses.clear();
    }
}

export const backendStatus = new BackendStatus();
