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

    addError(type, message, context = null) {
        const errors = appState.getState('ui.errors') || [];
        errors.push({
            type,
            message,
            context,
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
        // No UI notifications - just console logging
        // Users should not see error popups on this site
        return;
    }

    showErrorContainer(error) {
        // Disabled - no error notifications to users
        return;
    }

    hideErrorContainer() {
        // Disabled - no error notifications to users
        return;
    }

    createErrorContainer() {
        // Disabled - no error notifications to users
        return;
    }
}

// Centralized error reporting utility
export const reportError = (type, error, context = null) => {
    const message = error?.message || String(error);
    const errors = appState.getState('ui.errors') || [];
    errors.push({
        type,
        message,
        context,
        timestamp: Date.now(),
        id: Date.now() + Math.random()
    });

    // Keep only recent errors
    if (errors.length > 10) {
        errors.shift();
    }

    appState.setState('ui.errors', errors);
    console.error(`${type} error:`, error, context ? `Context: ${context}` : '');
};

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
