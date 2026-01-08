/**
 * EventBus.js
 * 
 * Simple event bus for inter-component communication.
 * Implements the publish-subscribe pattern for decoupled messaging.
 */

class EventBus {
    constructor() {
        this._events = new Map();
        this._onceEvents = new Map();
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[EventBus] Callback must be a function');
            return () => {};
        }
        
        if (!this._events.has(event)) {
            this._events.set(event, []);
        }
        
        this._events.get(event).push(callback);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[EventBus] Callback must be a function');
            return;
        }
        
        if (!this._onceEvents.has(event)) {
            this._onceEvents.set(event, []);
        }
        
        this._onceEvents.get(event).push(callback);
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to callbacks
     */
    emit(event, data) {
        // Regular subscribers
        if (this._events.has(event)) {
            this._events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error in callback for event "${event}":`, error);
                }
            });
        }
        
        // One-time subscribers
        if (this._onceEvents.has(event)) {
            const callbacks = this._onceEvents.get(event);
            this._onceEvents.delete(event);
            
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error in once callback for event "${event}":`, error);
                }
            });
        }
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback to remove
     */
    off(event, callback) {
        if (this._events.has(event)) {
            const callbacks = this._events.get(event).filter(cb => cb !== callback);
            
            if (callbacks.length > 0) {
                this._events.set(event, callbacks);
            } else {
                this._events.delete(event);
            }
        }
    }
    
    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, removes all if not provided)
     */
    clear(event) {
        if (event) {
            this._events.delete(event);
            this._onceEvents.delete(event);
        } else {
            this._events.clear();
            this._onceEvents.clear();
        }
    }
    
    /**
     * Get subscriber count for an event
     * @param {string} event - Event name
     * @returns {number} Number of subscribers
     */
    listenerCount(event) {
        let count = 0;
        
        if (this._events.has(event)) {
            count += this._events.get(event).length;
        }
        
        if (this._onceEvents.has(event)) {
            count += this._onceEvents.get(event).length;
        }
        
        return count;
    }
}

// Event name constants
export const Events = {
    // Navigation
    VIEW_CHANGED: 'view:changed',
    PERIOD_CHANGED: 'period:changed',
    APP_TAB_CHANGED: 'app:tab:changed',
    
    // Data loading
    DATA_LOADING: 'data:loading',
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error',
    
    // Filters
    FILTERS_CHANGED: 'filters:changed',
    FILTERS_RESET: 'filters:reset',
    
    // Selection
    CLIENT_SELECTED: 'client:selected',
    SESSION_SELECTED: 'session:selected',
    CONVERSATION_SELECTED: 'conversation:selected',
    
    // UI
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    TOAST_SHOW: 'toast:show',
    THEME_CHANGED: 'theme:changed',
    
    // Refresh
    REFRESH_TRIGGERED: 'refresh:triggered',
    REFRESH_COMPLETE: 'refresh:complete'
};

export const eventBus = new EventBus();
