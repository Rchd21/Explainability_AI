/**
 * app.js
 * 
 * Main application entry point for AI Detection Hub.
 * Initializes all components and manages navigation between detectors.
 */

import { config, eventBus, Events, state } from './core/index.js';
import { toast } from './components/index.js';
import { lungCancerView, audioFakeView } from './views/index.js';

/**
 * Main Application Class
 */
class App {
    constructor() {
        this._isInitialized = false;
        this._views = {
            'lung-cancer': lungCancerView,
            'audio-fake': audioFakeView
        };
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this._isInitialized) return;

        console.log('[App] Initializing AI Detection Hub...');

        try {
            // Initialize theme
            this._initializeTheme();

            // Initialize components
            toast.initialize();

            // Initialize views
            lungCancerView.initialize();
            audioFakeView.initialize();

            // Set up event handlers
            this._setupEventHandlers();

            // Set up navigation
            this._setupNavigation();

            this._isInitialized = true;
            console.log('[App] Initialization complete');

            // Show initial view
            this._switchDetector(state.currentDetector);

        } catch (error) {
            console.error('[App] Initialization failed:', error);
            toast.error('Initialization Error', 'Failed to initialize application');
        }
    }

    /**
     * Initialize theme from state
     */
    _initializeTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                state.toggleTheme();
            });
        }

        // Listen for theme changes
        eventBus.on(Events.THEME_CHANGED, ({ theme }) => {
            document.documentElement.setAttribute('data-theme', theme);
        });
    }

    /**
     * Set up navigation between detector tabs
     */
    _setupNavigation() {
        const tabsContainer = document.getElementById('detector-tabs');
        
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const tab = e.target.closest('.detector-tab');
                if (tab) {
                    const detector = tab.dataset.detector;
                    if (detector) {
                        state.setDetector(detector);
                    }
                }
            });
        }
    }

    /**
     * Set up global event handlers
     */
    _setupEventHandlers() {
        // Detector changed
        eventBus.on(Events.DETECTOR_CHANGED, ({ detector }) => {
            this._switchDetector(detector);
        });

        // Analysis events (for analytics/logging if needed)
        eventBus.on(Events.LUNG_ANALYSIS_START, () => {
            console.log('[App] Lung cancer analysis started');
        });

        eventBus.on(Events.LUNG_ANALYSIS_SUCCESS, ({ result }) => {
            console.log('[App] Lung cancer analysis complete:', result);
        });

        eventBus.on(Events.AUDIO_ANALYSIS_START, () => {
            console.log('[App] Audio fake analysis started');
        });

        eventBus.on(Events.AUDIO_ANALYSIS_SUCCESS, ({ result }) => {
            console.log('[App] Audio fake analysis complete:', result);
        });
    }

    /**
     * Switch between detector views
     * @param {string} detectorId - Detector to switch to
     */
    _switchDetector(detectorId) {
        // Update tab active states
        document.querySelectorAll('.detector-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.detector === detectorId);
        });

        // Hide all views
        Object.values(this._views).forEach(view => view.hide());

        // Show selected view
        const selectedView = this._views[detectorId];
        if (selectedView) {
            selectedView.show();
        }

        console.log(`[App] Switched to detector: ${detectorId}`);
    }

    /**
     * Get view by detector ID
     * @param {string} detectorId - Detector ID
     * @returns {Object} View instance
     */
    getView(detectorId) {
        return this._views[detectorId];
    }
}

// Create and initialize the application
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

// Expose app instance for debugging
window.aiDetectionApp = app;
window.aiDetectionState = state;
