/**
 * EventBus.js
 * 
 * Simple pub/sub event system for decoupled communication
 * between application components.
 */

class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        
        this._listeners.get(event).add(callback);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event (one-time)
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Clear all listeners for an event
     * @param {string} event - Event name (optional, clears all if not provided)
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }
}

// Event constants
export const Events = {
    // Navigation events
    DETECTOR_CHANGED: 'detector:changed',
    
    // Theme events
    THEME_CHANGED: 'theme:changed',
    
    // Lung cancer detector events
    LUNG_FILE_SELECTED: 'lung:file:selected',
    LUNG_FILE_REMOVED: 'lung:file:removed',
    LUNG_XAI_CHANGED: 'lung:xai:changed',
    LUNG_ANALYSIS_START: 'lung:analysis:start',
    LUNG_ANALYSIS_SUCCESS: 'lung:analysis:success',
    LUNG_ANALYSIS_ERROR: 'lung:analysis:error',
    
    // Audio detector events
    AUDIO_FILE_SELECTED: 'audio:file:selected',
    AUDIO_FILE_REMOVED: 'audio:file:removed',
    AUDIO_ANALYSIS_START: 'audio:analysis:start',
    AUDIO_ANALYSIS_SUCCESS: 'audio:analysis:success',
    AUDIO_ANALYSIS_ERROR: 'audio:analysis:error',
    
    // Toast events
    TOAST_SHOW: 'toast:show'
};

export const eventBus = new EventBus();
