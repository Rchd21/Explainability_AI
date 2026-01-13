/**
 * LungCancerView.js
 * 
 * View controller for the lung cancer detection interface.
 * Manages file upload, XAI method selection, and results display.
 */

import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { config } from '../core/Config.js';
import { FileUpload } from '../components/FileUpload.js';
import { toast } from '../components/Toast.js';
import { lungCancerService } from '../services/LungCancerService.js';

class LungCancerView {
    constructor() {
        this._fileUpload = null;
        this._selectedXaiMethod = 'gradcam';
        this._elements = {};
    }

    /**
     * Initialize the view
     */
    initialize() {
        this._cacheElements();
        this._initializeFileUpload();
        this._setupEventListeners();
        this._updateSubmitButton();
        
        console.log('[LungCancerView] Initialized');
    }

    /**
     * Cache DOM elements
     */
    _cacheElements() {
        this._elements = {
            view: document.getElementById('lung-cancer-view'),
            submitBtn: document.getElementById('lung-submit-btn'),
            xaiOptions: document.getElementById('lung-xai-options'),
            
            // Results
            resultsEmpty: document.getElementById('lung-results-empty'),
            resultsLoading: document.getElementById('lung-results-loading'),
            resultsContent: document.getElementById('lung-results-content'),
            loadingStep: document.getElementById('lung-loading-step'),
            
            // Prediction
            prediction: document.getElementById('lung-prediction'),
            predictionIcon: document.getElementById('lung-prediction-icon'),
            predictionLabel: document.getElementById('lung-prediction-label'),
            predictionValue: document.getElementById('lung-prediction-value'),
            confidenceValue: document.getElementById('lung-confidence-value'),
            
            // XAI visualization
            xaiMethodName: document.getElementById('lung-xai-method-name'),
            xaiImage: document.getElementById('lung-xai-image'),
            xaiLegend: document.getElementById('lung-xai-legend'),
            
            // Meta
            duration: document.getElementById('lung-duration'),
            xaiUsed: document.getElementById('lung-xai-used')
        };
    }

    /**
     * Initialize file upload component
     */
    _initializeFileUpload() {
        this._fileUpload = new FileUpload({
            detectorType: 'lungCancer',
            zoneId: 'lung-upload-zone',
            inputId: 'lung-file-input',
            previewId: 'lung-image-preview',
            events: {
                selected: Events.LUNG_FILE_SELECTED,
                removed: Events.LUNG_FILE_REMOVED
            }
        });
        
        this._fileUpload.initialize();
    }

    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // File events
        eventBus.on(Events.LUNG_FILE_SELECTED, () => this._updateSubmitButton());
        eventBus.on(Events.LUNG_FILE_REMOVED, () => {
            this._updateSubmitButton();
            this._showEmptyState();
        });
        
        // XAI method selection
        if (this._elements.xaiOptions) {
            this._elements.xaiOptions.addEventListener('change', (e) => {
                if (e.target.type === 'radio') {
                    this._selectedXaiMethod = e.target.value;
                    eventBus.emit(Events.LUNG_XAI_CHANGED, { method: e.target.value });
                }
            });
        }
        
        // Submit button
        if (this._elements.submitBtn) {
            this._elements.submitBtn.addEventListener('click', () => this._handleSubmit());
        }
    }

    /**
     * Update submit button state
     */
    _updateSubmitButton() {
        if (this._elements.submitBtn) {
            const hasFile = this._fileUpload?.hasFile();
            this._elements.submitBtn.disabled = !hasFile || state.isLoading('lungCancer');
        }
    }

    /**
     * Handle form submission
     */
    async _handleSubmit() {
        const file = this._fileUpload?.getFile();
        
        if (!file) {
            toast.warning('No Image', 'Please upload an image first');
            return;
        }
        
        state.setLoading('lungCancer', true);
        this._elements.submitBtn.classList.add('loading');
        this._elements.submitBtn.disabled = true;
        
        this._showLoadingState();
        eventBus.emit(Events.LUNG_ANALYSIS_START, {});
        
        try {
            // Update loading steps
            this._updateLoadingStep('Uploading CT scan image...');
            await this._delay(300);
            
            this._updateLoadingStep('Preprocessing image for model input...');
            await this._delay(200);
            
            this._updateLoadingStep('Running neural network inference...');
            
            const result = await lungCancerService.detect(file, this._selectedXaiMethod);
            
            this._updateLoadingStep('Computing XAI explanation...');
            await this._delay(200);
            
            this._showResults(result);
            eventBus.emit(Events.LUNG_ANALYSIS_SUCCESS, { result });
            
            toast.success(
                'Analysis Complete',
                result.isPositive 
                    ? 'Potential abnormality detected. Please consult a healthcare professional.'
                    : 'No abnormality detected in the scan.'
            );
        } catch (error) {
            console.error('[LungCancerView] Analysis error:', error);
            this._showEmptyState();
            eventBus.emit(Events.LUNG_ANALYSIS_ERROR, { error: error.message });
            toast.error('Analysis Failed', error.message);
        } finally {
            state.setLoading('lungCancer', false);
            this._elements.submitBtn.classList.remove('loading');
            this._updateSubmitButton();
        }
    }

    /**
     * Show empty state
     */
    _showEmptyState() {
        this._elements.resultsEmpty?.classList.remove('hidden');
        this._elements.resultsLoading?.classList.add('hidden');
        this._elements.resultsContent?.classList.add('hidden');
    }

    /**
     * Show loading state
     */
    _showLoadingState() {
        this._elements.resultsEmpty?.classList.add('hidden');
        this._elements.resultsLoading?.classList.remove('hidden');
        this._elements.resultsContent?.classList.add('hidden');
    }

    /**
     * Update loading step text
     * @param {string} text - Step description
     */
    _updateLoadingStep(text) {
        if (this._elements.loadingStep) {
            this._elements.loadingStep.textContent = text;
        }
    }

    /**
     * Show results
     * @param {Object} result - Analysis result
     */
    _showResults(result) {
        this._elements.resultsEmpty?.classList.add('hidden');
        this._elements.resultsLoading?.classList.add('hidden');
        this._elements.resultsContent?.classList.remove('hidden');
        
        // Update prediction display with correct colors
        // Red for cancer detected (danger), Green for no cancer (safe)
        const predictionEl = this._elements.prediction;
        if (predictionEl) {
            predictionEl.classList.remove('positive', 'negative', 'danger', 'safe');
            // isPositive = cancer detected = danger (red)
            // !isPositive = no cancer = safe (green)
            predictionEl.classList.add(result.isPositive ? 'danger' : 'safe');
        }
        
        if (this._elements.predictionIcon) {
            this._elements.predictionIcon.textContent = result.isPositive ? '⚠' : '✓';
        }
        
        if (this._elements.predictionLabel) {
            this._elements.predictionLabel.textContent = 'Decision';
        }
        
        if (this._elements.predictionValue) {
            this._elements.predictionValue.textContent = result.label;
        }
        
        if (this._elements.confidenceValue) {
            // Display score as percentage
            const score = (result.score * 100).toFixed(1);
            this._elements.confidenceValue.textContent = `${score}%`;
        }
        
        // Update XAI visualization
        const xaiMethodNames = {
            'gradcam': 'Grad-CAM',
            'lime': 'LIME'
        };
        
        if (this._elements.xaiMethodName) {
            this._elements.xaiMethodName.textContent = xaiMethodNames[result.xaiMethod] || result.xaiMethod;
        }
        
        if (this._elements.xaiImage && result.xaiImageUrl) {
            this._elements.xaiImage.src = result.xaiImageUrl;
        }
        
        // Update XAI legend based on method
        this._updateXaiLegend(result.xaiMethod);
        
        // Update meta
        if (this._elements.duration) {
            this._elements.duration.textContent = `${result.duration.toFixed(2)}s`;
        }
        
        if (this._elements.xaiUsed) {
            this._elements.xaiUsed.textContent = xaiMethodNames[result.xaiMethod] || result.xaiMethod;
        }
    }

    /**
     * Update XAI legend based on method
     * @param {string} xaiMethod - XAI method used
     */
    _updateXaiLegend(xaiMethod) {
        const legendContainer = this._elements.xaiLegend;
        if (!legendContainer) return;

        const methodConfig = config.getXaiMethodConfig('lungCancer', xaiMethod);
        if (!methodConfig || !methodConfig.legend) {
            legendContainer.innerHTML = '';
            return;
        }

        const { title, items, note } = methodConfig.legend;

        let html = '<div class="xai-legend-card">';
        
        // Title
        if (title) {
            html += `<h5 class="xai-legend-title">${title}</h5>`;
        }
        
        // Legend items
        html += '<div class="xai-legend-items">';
        items.forEach(item => {
            html += `
                <div class="xai-legend-row">
                    <span class="xai-legend-icon" style="background: ${item.color}20; border-color: ${item.color};">${item.icon}</span>
                    <span class="xai-legend-text">${item.text}</span>
                </div>
            `;
        });
        html += '</div>';
        
        // Note
        if (note) {
            html += `
                <div class="xai-legend-note">
                    <span class="xai-legend-note-icon">${note.icon}</span>
                    <span class="xai-legend-note-text">${note.text}</span>
                </div>
            `;
        }
        
        html += '</div>';
        
        legendContainer.innerHTML = html;
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to wait
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Show the view
     */
    show() {
        this._elements.view?.classList.add('active');
    }

    /**
     * Hide the view
     */
    hide() {
        this._elements.view?.classList.remove('active');
    }

    /**
     * Reset the view
     */
    reset() {
        this._fileUpload?.removeFile();
        this._showEmptyState();
    }
}

export const lungCancerView = new LungCancerView();
