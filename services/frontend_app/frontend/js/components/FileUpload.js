/**
 * FileUpload.js
 * 
 * Reusable file upload component with drag-and-drop support.
 * Handles image and audio file uploads with preview.
 * Always allows file removal and new upload.
 */

import { config } from '../core/Config.js';
import { eventBus, Events } from '../core/EventBus.js';
import { toast } from './Toast.js';

class FileUpload {
    /**
     * Create a FileUpload instance
     * @param {Object} options - Configuration options
     * @param {string} options.detectorType - Detector type ('lungCancer' or 'audioFake')
     * @param {string} options.zoneId - Upload zone element ID
     * @param {string} options.inputId - File input element ID
     * @param {string} options.previewId - Preview container element ID
     * @param {Object} options.events - Event names for this uploader
     */
    constructor(options) {
        this._detectorType = options.detectorType;
        this._zoneId = options.zoneId;
        this._inputId = options.inputId;
        this._previewId = options.previewId;
        this._events = options.events;
        
        this._zone = null;
        this._input = null;
        this._preview = null;
        this._currentFile = null;
        this._objectUrl = null; // Track object URL for cleanup
    }

    /**
     * Initialize the file upload component
     */
    initialize() {
        this._zone = document.getElementById(this._zoneId);
        this._input = document.getElementById(this._inputId);
        this._preview = document.getElementById(this._previewId);

        if (!this._zone || !this._input) {
            console.error(`[FileUpload] Missing elements for ${this._detectorType}`);
            return;
        }

        this._setupEventListeners();
        
        // Ensure initial state is correct
        this._resetState();
        
        console.log(`[FileUpload] Initialized for ${this._detectorType}`);
    }

    /**
     * Set up event listeners for drag-and-drop and file input
     */
    _setupEventListeners() {
        // Click to open file dialog
        this._zone.addEventListener('click', (e) => {
            // Prevent click on remove button from opening file dialog
            if (e.target.closest('.preview-remove')) return;
            this._input.click();
        });

        // File input change
        this._input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this._handleFile(file);
            }
        });

        // Drag events
        this._zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._zone.classList.add('drag-over');
        });

        this._zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._zone.classList.remove('drag-over');
        });

        this._zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._zone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this._handleFile(file);
            }
        });

        // Preview remove buttons - set up for both possible button locations
        this._setupRemoveButton();
    }

    /**
     * Set up remove button event listener
     */
    _setupRemoveButton() {
        // For image preview - button with id lung-preview-remove or audio-preview-remove
        const removeId = `${this._detectorType === 'lungCancer' ? 'lung' : 'audio'}-preview-remove`;
        const removeBtn = document.getElementById(removeId);
        
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeFile();
            });
        }

        // Also check within preview container for .preview-remove, .audio-remove-btn, or .image-remove-btn
        if (this._preview) {
            const previewRemoveBtn = this._preview.querySelector('.preview-remove, .audio-remove-btn, .image-remove-btn');
            if (previewRemoveBtn && previewRemoveBtn !== removeBtn) {
                previewRemoveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.removeFile();
                });
            }
        }
    }

    /**
     * Handle file selection
     * @param {File} file - Selected file
     */
    _handleFile(file) {
        // Validate file
        const validation = config.validateFile(file, this._detectorType);
        
        if (!validation.valid) {
            toast.error('Invalid File', validation.error);
            // Reset the input
            this._input.value = '';
            return;
        }

        // Clean up previous file if any
        this._cleanupObjectUrl();

        this._currentFile = file;
        this._showPreview(file);
        
        // Update zone state
        this._zone.classList.add('has-file');
        
        // Hide upload content, show preview
        const uploadContent = this._zone.querySelector('.upload-zone-content');
        if (uploadContent) {
            uploadContent.style.display = 'none';
        }
        
        // Emit file selected event
        eventBus.emit(this._events.selected, { file });
    }

    /**
     * Show file preview
     * @param {File} file - File to preview
     */
    _showPreview(file) {
        if (!this._preview) return;

        if (this._detectorType === 'lungCancer') {
            this._showImagePreview(file);
        } else if (this._detectorType === 'audioFake') {
            this._showAudioPreview(file);
        }
    }

    /**
     * Show image preview
     * @param {File} file - Image file
     */
    _showImagePreview(file) {
        const img = this._preview.querySelector('img');
        const filename = this._preview.querySelector('.preview-filename, [id$="-preview-filename"]');
        
        if (img && file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        if (filename) {
            filename.textContent = file.name;
        }
        
        this._preview.classList.add('visible');
        this._preview.classList.remove('hidden');
        this._preview.style.display = '';
    }

    /**
     * Show audio preview
     * @param {File} file - Audio file
     */
    _showAudioPreview(file) {
        const audio = this._preview.querySelector('audio');
        const filename = this._preview.querySelector('.audio-filename, [id$="-preview-filename"]');
        
        if (audio && file) {
            // Clean up previous object URL
            this._cleanupObjectUrl();
            
            this._objectUrl = URL.createObjectURL(file);
            audio.src = this._objectUrl;
        }
        
        if (filename) {
            filename.textContent = file.name;
        }
        
        this._preview.classList.add('visible');
        this._preview.classList.remove('hidden');
        this._preview.style.display = '';
    }

    /**
     * Clean up object URL to prevent memory leaks
     */
    _cleanupObjectUrl() {
        if (this._objectUrl) {
            URL.revokeObjectURL(this._objectUrl);
            this._objectUrl = null;
        }
    }

    /**
     * Reset state to initial
     */
    _resetState() {
        this._currentFile = null;
        this._input.value = '';
        this._zone.classList.remove('has-file', 'drag-over');
        
        // Show upload content
        const uploadContent = this._zone.querySelector('.upload-zone-content');
        if (uploadContent) {
            uploadContent.style.display = '';
        }
        
        // Hide preview
        if (this._preview) {
            this._preview.classList.remove('visible');
            this._preview.classList.add('hidden');
            
            const img = this._preview.querySelector('img');
            if (img) img.src = '';
            
            const audio = this._preview.querySelector('audio');
            if (audio) {
                audio.pause();
                audio.src = '';
            }
        }
        
        this._cleanupObjectUrl();
    }

    /**
     * Remove current file
     */
    removeFile() {
        console.log(`[FileUpload] Removing file for ${this._detectorType}`);
        
        this._resetState();
        
        // Emit file removed event
        eventBus.emit(this._events.removed, {});
    }

    /**
     * Get current file
     * @returns {File|null} Current file
     */
    getFile() {
        return this._currentFile;
    }

    /**
     * Check if a file is selected
     * @returns {boolean} True if file is selected
     */
    hasFile() {
        return this._currentFile !== null;
    }

    /**
     * Destroy the component and clean up
     */
    destroy() {
        this._cleanupObjectUrl();
        this._currentFile = null;
    }
}

export { FileUpload };
