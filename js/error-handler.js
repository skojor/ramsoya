// Global error handler and UI state manager
import { appState } from './state-manager.js';

export class ErrorHandler {
    constructor() {
        this.maxErrors = 10;
        this.errorContainer = null;
        this.setupStateSubscriptions();
        this.setupGlobalErrorHandling();
    }

    setupStateSubscriptions() {
        // Listen for errors and display them
        appState.subscribe('ui.errors', (errors) => {
            this.displayErrors(errors);
        });

        // Auto-clear old errors
        setInterval(() => {
            this.clearOldErrors();
        }, 30000); // Clear errors older than 30 seconds
    }

    setupGlobalErrorHandling() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.addError('unhandled', event.reason?.message || 'Unhandled promise rejection');
            console.error('Unhandled promise rejection:', event.reason);
        });

        // Catch global JavaScript errors
        window.addEventListener('error', (event) => {
            this.addError('javascript', event.message);
            console.error('Global error:', event.error);
        });
    }

    addError(type, message) {
        const errors = appState.getState('ui.errors') || [];
        errors.push({
            type,
            message,
            timestamp: Date.now(),
            id: Date.now() + Math.random()
        });

        // Keep only recent errors
        if (errors.length > this.maxErrors) {
            errors.shift();
        }

        appState.setState('ui.errors', errors);
    }

    clearOldErrors() {
        const errors = appState.getState('ui.errors') || [];
        const now = Date.now();
        const recentErrors = errors.filter(error =>
            now - error.timestamp < 60000 // Keep errors for 1 minute
        );

        if (recentErrors.length !== errors.length) {
            appState.setState('ui.errors', recentErrors);
        }
    }

    displayErrors(errors) {
        // Only show critical errors in UI
        const criticalErrors = errors.filter(error =>
            ['weather', 'ais', 'adsb', 'image'].includes(error.type)
        );

        if (criticalErrors.length === 0) {
            this.hideErrorContainer();
            return;
        }

        // Show the most recent critical error
        const latestError = criticalErrors[criticalErrors.length - 1];
        this.showErrorContainer(latestError);
    }

    showErrorContainer(error) {
        if (!this.errorContainer) {
            this.createErrorContainer();
        }

        const timeAgo = Math.floor((Date.now() - error.timestamp) / 1000);
        this.errorContainer.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${error.message}</span>
                <span class="error-time">${timeAgo}s ago</span>
                <button class="error-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
        `;
        this.errorContainer.style.display = 'block';
    }

    hideErrorContainer() {
        if (this.errorContainer) {
            this.errorContainer.style.display = 'none';
        }
    }

    createErrorContainer() {
        this.errorContainer = document.createElement('div');
        this.errorContainer.id = 'global-errors';
        this.errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(220, 53, 69, 0.95);
            color: white;
            padding: 12px;
            border-radius: 8px;
            max-width: 300px;
            z-index: 10000;
            display: none;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const style = document.createElement('style');
        style.textContent = `
            #global-errors .error-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #global-errors .error-icon {
                font-size: 16px;
            }
            #global-errors .error-message {
                flex: 1;
                word-break: break-word;
            }
            #global-errors .error-time {
                font-size: 12px;
                opacity: 0.8;
            }
            #global-errors .error-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
            }
            #global-errors .error-close:hover {
                opacity: 0.7;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.errorContainer);
    }
}

// State-based activity tracker
export class ActivityTracker {
    constructor() {
        this.setupStateSubscriptions();
        this.trackActivity();
    }

    setupStateSubscriptions() {
        // Track when data is fetched successfully
        appState.subscribeMultiple([
            'weather.lastUpdate',
            'image.lastUpdate',
            'location.ais',
            'location.adsb'
        ], () => {
            appState.setState('app.lastActivity', Date.now());
        });
    }

    trackActivity() {
        // Update activity every minute
        setInterval(() => {
            const lastActivity = appState.getState('app.lastActivity');
            const timeSinceActivity = Date.now() - lastActivity;

            // If no activity for 5 minutes, something might be wrong
            if (timeSinceActivity > 5 * 60 * 1000) {
                console.warn('No data activity for 5 minutes');
                const errors = appState.getState('ui.errors') || [];
                errors.push({
                    type: 'activity',
                    message: 'No data updates for 5 minutes',
                    timestamp: Date.now()
                });
                appState.setState('ui.errors', errors);
            }
        }, 60000);
    }
}
