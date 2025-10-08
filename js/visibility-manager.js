// Visibility-aware interval management for real-time applications
// Reduces update frequency when tab is not visible to save resources

export class VisibilityManager {
    constructor() {
        this.intervals = new Map();
        this.isVisible = !document.hidden;
        this.visibilityMultiplier = 3; // Slow down by 3x when hidden

        this.setupVisibilityListener();
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            const wasVisible = this.isVisible;
            this.isVisible = !document.hidden;

            if (wasVisible !== this.isVisible) {
                this.adjustAllIntervals();
            }
        });
    }

    /**
     * Register an interval with visibility-aware timing
     * @param {string} key - Unique identifier for the interval
     * @param {Function} callback - Function to execute
     * @param {number} normalInterval - Normal interval in milliseconds
     * @param {number} hiddenMultiplier - Multiplier when hidden (default: 3x slower)
     */
    setInterval(key, callback, normalInterval, hiddenMultiplier = this.visibilityMultiplier) {
        // Clear existing interval if any
        this.clearInterval(key);

        const config = {
            callback,
            normalInterval,
            hiddenMultiplier,
            currentInterval: null
        };

        this.intervals.set(key, config);
        this.startInterval(key);

        return key;
    }

    startInterval(key) {
        const config = this.intervals.get(key);
        if (!config) return;

        const interval = this.isVisible ?
            config.normalInterval :
            config.normalInterval * config.hiddenMultiplier;

        config.currentInterval = setInterval(config.callback, interval);
    }

    clearInterval(key) {
        const config = this.intervals.get(key);
        if (config?.currentInterval) {
            clearInterval(config.currentInterval);
            config.currentInterval = null;
        }
        this.intervals.delete(key);
    }

    adjustAllIntervals() {
        for (const [key, config] of this.intervals) {
            if (config.currentInterval) {
                clearInterval(config.currentInterval);
                this.startInterval(key);
            }
        }
    }


    /**
     * Pause all intervals (useful for debugging or manual control)
     */
    pauseAll() {
        for (const [config] of this.intervals.values()) {
            if (config.currentInterval) {
                clearInterval(config.currentInterval);
                config.currentInterval = null;
            }
        }
    }


}

// Create singleton instance
export const visibilityManager = new VisibilityManager();
