/**
 * AudioFakeView.js
 * 
 * View controller for the audio fake detection interface.
 * Manages audio upload, XAI method selection, and results display.
 */

import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { config } from '../core/Config.js';
import { FileUpload } from '../components/FileUpload.js';
import { toast } from '../components/Toast.js';
import { audioFakeService } from '../services/AudioFakeService.js';

class AudioFakeView {
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
        
        console.log('[AudioFakeView] Initialized');
    }

    /**
     * Cache DOM elements
     */
    _cacheElements() {
        this._elements = {
            view: document.getElementById('audio-fake-view'),
            submitBtn: document.getElementById('audio-submit-btn'),
            xaiOptions: document.getElementById('audio-xai-options'),
            
            // Results
            resultsEmpty: document.getElementById('audio-results-empty'),
            resultsLoading: document.getElementById('audio-results-loading'),
            resultsContent: document.getElementById('audio-results-content'),
            loadingStep: document.getElementById('audio-loading-step'),
            
            // Prediction
            prediction: document.getElementById('audio-prediction'),
            predictionIcon: document.getElementById('audio-prediction-icon'),
            predictionLabel: document.getElementById('audio-prediction-label'),
            predictionValue: document.getElementById('audio-prediction-value'),
            confidenceValue: document.getElementById('audio-confidence-value'),
            
            // XAI visualization
            xaiMethodName: document.getElementById('audio-xai-method-name'),
            xaiImage: document.getElementById('audio-xai-image'),
            xaiLegend: document.getElementById('audio-xai-legend'),
            
            // Meta
            duration: document.getElementById('audio-duration'),
            xaiUsed: document.getElementById('audio-xai-used')
        };
    }

    /**
     * Initialize file upload component
     */
    _initializeFileUpload() {
        this._fileUpload = new FileUpload({
            detectorType: 'audioFake',
            zoneId: 'audio-upload-zone',
            inputId: 'audio-file-input',
            previewId: 'audio-preview',
            events: {
                selected: Events.AUDIO_FILE_SELECTED,
                removed: Events.AUDIO_FILE_REMOVED
            }
        });
        
        this._fileUpload.initialize();
    }

    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // File events
        eventBus.on(Events.AUDIO_FILE_SELECTED, () => this._updateSubmitButton());
        eventBus.on(Events.AUDIO_FILE_REMOVED, () => {
            this._updateSubmitButton();
            this._showEmptyState();
        });
        
        // XAI method selection
        if (this._elements.xaiOptions) {
            this._elements.xaiOptions.addEventListener('change', (e) => {
                if (e.target.type === 'radio' && e.target.name === 'audio-xai-method') {
                    this._selectedXaiMethod = e.target.value;
                    console.log('[AudioFakeView] XAI method changed:', this._selectedXaiMethod);
                }
            });
        }
        
        // Submit button
        if (this._elements.submitBtn) {
            this._elements.submitBtn.addEventListener('click', () => this._handleSubmit());
        }
    }

    /**
     * Get selected XAI method
     * @returns {string} Selected XAI method
     */
    _getSelectedXaiMethod() {
        const selected = document.querySelector('input[name="audio-xai-method"]:checked');
        return selected ? selected.value : 'gradcam';
    }

    /**
     * Update submit button state
     */
    _updateSubmitButton() {
        if (this._elements.submitBtn) {
            const hasFile = this._fileUpload?.hasFile();
            this._elements.submitBtn.disabled = !hasFile || state.isLoading('audioFake');
        }
    }

    /**
     * Handle form submission
     */
    async _handleSubmit() {
        const file = this._fileUpload?.getFile();
        const xaiMethod = this._getSelectedXaiMethod();
        
        if (!file) {
            toast.warning('No Audio', 'Please upload an audio file first');
            return;
        }
        
        state.setLoading('audioFake', true);
        this._elements.submitBtn.classList.add('loading');
        this._elements.submitBtn.disabled = true;
        
        this._showLoadingState();
        eventBus.emit(Events.AUDIO_ANALYSIS_START, { xaiMethod });
        
        try {
            // Update loading steps
            this._updateLoadingStep('Uploading audio file...');
            await this._delay(200);
            
            this._updateLoadingStep('Converting audio to spectrogram...');
            await this._delay(200);
            
            this._updateLoadingStep('Running deepfake detection model...');
            
            const result = await audioFakeService.detect(file, xaiMethod);
            
            this._updateLoadingStep('Computing XAI explanation...');
            await this._delay(200);
            
            this._showResults(result);
            eventBus.emit(Events.AUDIO_ANALYSIS_SUCCESS, { result });
            
            toast.success(
                'Analysis Complete',
                result.isFake 
                    ? 'This audio appears to be AI-generated or manipulated.'
                    : 'This audio appears to be authentic.'
            );
        } catch (error) {
            console.error('[AudioFakeView] Analysis error:', error);
            this._showEmptyState();
            eventBus.emit(Events.AUDIO_ANALYSIS_ERROR, { error: error.message });
            toast.error('Analysis Failed', error.message);
        } finally {
            state.setLoading('audioFake', false);
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
        // Red for fake (danger), Green for real (safe)
        const predictionEl = this._elements.prediction;
        if (predictionEl) {
            predictionEl.classList.remove('positive', 'negative', 'danger', 'safe');
            // isFake = danger (red), !isFake = safe (green)
            predictionEl.classList.add(result.isFake ? 'danger' : 'safe');
        }
        
        if (this._elements.predictionIcon) {
            this._elements.predictionIcon.textContent = result.isFake ? '⚠' : '✓';
        }
        
        if (this._elements.predictionLabel) {
            this._elements.predictionLabel.textContent = 'Decision';
        }
        
        if (this._elements.predictionValue) {
            this._elements.predictionValue.textContent = result.decision;
        }
        
        if (this._elements.confidenceValue) {
            const confidence = (result.confidence * 100).toFixed(1);
            this._elements.confidenceValue.textContent = `${confidence}%`;
        }
        
        // Update XAI visualization
        const xaiMethodNames = {
            'gradcam': 'Grad-CAM',
            'lime': 'LIME',
            'shap': 'SHAP'
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

        const methodConfig = config.getXaiMethodConfig('audioFake', xaiMethod);
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
        this._selectedXaiMethod = 'gradcam';
        
        // Reset XAI selection to default
        const defaultXai = document.querySelector('input[name="audio-xai-method"][value="gradcam"]');
        if (defaultXai) {
            defaultXai.checked = true;
        }
    }
}

export const audioFakeView = new AudioFakeView();
