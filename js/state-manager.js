// Simple reactive state management system
export class StateManager {
    constructor() {
        this.state = {};
        this.subscribers = new Map(); // Map of state keys to arrays of callback functions
        this.history = new Map(); // Optional state history for debugging
    }

    /**
     * Set a state value and notify subscribers
     * @param {string} key - State key (e.g., 'weather.current', 'image.status')
     * @param {any} value - New value
     * @param {Object} options - Options like silent update
     */
    setState(key, value, options = {}) {
        const oldValue = this.getState(key);

        // Set nested state using dot notation
        this.setNestedValue(this.state, key, value);

        // Store history for debugging
        if (!this.history.has(key)) {
            this.history.set(key, []);
        }
        this.history.get(key).push({
            timestamp: Date.now(),
            oldValue,
            newValue: value
        });

        // Keep only last 10 history entries per key
        const hist = this.history.get(key);
        if (hist.length > 10) {
            hist.shift();
        }

        // Notify subscribers unless silent
        if (!options.silent && this.subscribers.has(key)) {
            this.subscribers.get(key).forEach(callback => {
                try {
                    callback(value, oldValue, key);
                } catch (error) {
                    console.error(`State subscriber error for key '${key}':`, error);
                }
            });
        }

        return this;
    }

    /**
     * Get a state value using dot notation
     * @param {string} key - State key
     * @returns {any} State value
     */
    getState(key) {
        return this.getNestedValue(this.state, key);
    }

    /**
     * Subscribe to state changes for a specific key
     * @param {string} key - State key to watch
     * @param {Function} callback - Callback function (newValue, oldValue, key) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }

        this.subscribers.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Subscribe to multiple state keys
     * @param {string[]} keys - Array of state keys
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeMultiple(keys, callback) {
        const unsubscribers = keys.map(key => this.subscribe(key, callback));

        // Return function that unsubscribes from all
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }

    /**
     * Get current state snapshot
     * @returns {Object} Deep copy of current state
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Clear all state and subscribers
     */
    clear() {
        this.state = {};
        this.subscribers.clear();
        this.history.clear();
    }

    /**
     * Get state history for debugging
     * @param {string} key - State key
     * @returns {Array} History entries
     */
    getHistory(key) {
        return this.history.get(key) || [];
    }

    // Helper methods for nested object access
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    getNestedValue(obj, path) {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current == null || typeof current !== 'object') {
                return undefined;
            }
            current = current[key];
        }

        return current;
    }
}

// Create singleton instance
export const appState = new StateManager();

// Define initial state structure
appState.setState('app.initialized', false, { silent: true });
appState.setState('app.lastActivity', Date.now(), { silent: true });

// Image state
appState.setState('image.url', null, { silent: true });
appState.setState('image.lastUpdate', null, { silent: true });
appState.setState('image.captureTime', null, { silent: true });
appState.setState('image.status', 'loading', { silent: true });

// Weather state
appState.setState('weather.current', null, { silent: true });
appState.setState('weather.lastUpdate', null, { silent: true });
appState.setState('weather.forecast', null, { silent: true });

// Location-based data
appState.setState('location.ais', [], { silent: true });
appState.setState('location.adsb', [], { silent: true });
appState.setState('location.tidal', null, { silent: true });

// Transport data
appState.setState('transport.entur', null, { silent: true });

// Astronomical data
appState.setState('astronomy.moon', null, { silent: true });
appState.setState('astronomy.solar', null, { silent: true });

// UI state
appState.setState('ui.activeTab', null, { silent: true });
appState.setState('ui.errors', [], { silent: true });

console.log('State management initialized');
