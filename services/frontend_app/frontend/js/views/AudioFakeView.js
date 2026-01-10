/**
 * AudioFakeView.js
 * 
 * View controller for the audio fake detection interface.
 * Manages audio upload and results display.
 */

import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { FileUpload } from '../components/FileUpload.js';
import { toast } from '../components/Toast.js';
import { audioFakeService } from '../services/AudioFakeService.js';

class AudioFakeView {
    constructor() {
        this._fileUpload = null;
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
            
            // Spectrogram
            spectrogram: document.getElementById('audio-spectrogram'),
            
            // Meta
            duration: document.getElementById('audio-duration'),
            audioLength: document.getElementById('audio-length')
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
            this._elements.submitBtn.disabled = !hasFile || state.isLoading('audioFake');
        }
    }

    /**
     * Handle form submission
     */
    async _handleSubmit() {
        const file = this._fileUpload?.getFile();
        
        if (!file) {
            toast.warning('No Audio', 'Please upload an audio file first');
            return;
        }
        
        state.setLoading('audioFake', true);
        this._elements.submitBtn.classList.add('loading');
        this._elements.submitBtn.disabled = true;
        
        this._showLoadingState();
        eventBus.emit(Events.AUDIO_ANALYSIS_START, {});
        
        try {
            // Update loading steps
            this._updateLoadingStep('Uploading audio...');
            await this._delay(500);
            
            this._updateLoadingStep('Extracting audio features...');
            await this._delay(300);
            
            this._updateLoadingStep('Running fake detection model...');
            
            const result = await audioFakeService.detect(file);
            
            this._updateLoadingStep('Generating analysis report...');
            await this._delay(300);
            
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
        
        // Update prediction display
        const predictionEl = this._elements.prediction;
        if (predictionEl) {
            predictionEl.classList.remove('positive', 'negative');
            // For audio: "positive" means fake detected (bad), "negative" means authentic (good)
            predictionEl.classList.add(result.isFake ? 'positive' : 'negative');
        }
        
        if (this._elements.predictionIcon) {
            this._elements.predictionIcon.textContent = result.isFake ? '⚠' : '✓';
        }
        
        if (this._elements.predictionLabel) {
            this._elements.predictionLabel.textContent = 'Prediction';
        }
        
        if (this._elements.predictionValue) {
            this._elements.predictionValue.textContent = result.label;
        }
        
        if (this._elements.confidenceValue) {
            const confidence = (result.confidence * 100).toFixed(1);
            this._elements.confidenceValue.textContent = `${confidence}%`;
        }
        
        // Update spectrogram if available
        if (this._elements.spectrogram && result.spectrogramUrl) {
            this._elements.spectrogram.src = result.spectrogramUrl;
            this._elements.spectrogram.parentElement.style.display = 'block';
        }
        
        // Update meta
        if (this._elements.duration) {
            this._elements.duration.textContent = `${result.duration.toFixed(2)}s`;
        }
        
        if (this._elements.audioLength && result.audioLength) {
            this._elements.audioLength.textContent = this._formatDuration(result.audioLength);
        }
    }

    /**
     * Format duration in seconds to MM:SS
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    _formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

export const audioFakeView = new AudioFakeView();
