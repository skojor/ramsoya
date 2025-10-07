// Main entry point for the weather application
import './tooltip-helpers.js';
import './windbarb-helpers.js';
import { WeatherApp } from './weather-app.js';
import { AISManager } from './ais-manager.js';
import { ADSBManager } from './adsb-manager.js';
import { TidalManager } from './tidal-manager.js';
import { EnturManager } from './entur-manager.js';
import { ChartManager } from './chart-manager.js';
import { UIManager } from './ui-manager.js';
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { ErrorHandler, ActivityTracker } from './error-handler.js';

// Legacy global configuration for backward compatibility
window.WIND_FLIP = CONFIG.WIND_FLIP;

// Initialize all manager classes when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Ramsøyvika Weather Station...');

    // Initialize state management system
    const errorHandler = new ErrorHandler();
    const activityTracker = new ActivityTracker();

    // Set app as initialized
    appState.setState('app.initialized', true);

    // Initialize core weather app (handles image, weather, moon, forecast, solar)
    const weatherApp = new WeatherApp();
    weatherApp.init();

    // Initialize additional feature managers
    new AISManager();
    new ADSBManager();
    new TidalManager();
    new EnturManager();
    new ChartManager();
    new UIManager();

    // Set up state debugging in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.appState = appState; // Expose for debugging
        console.log('🔧 Development mode: appState available in console');

        // Log state changes in development
        const originalSetState = appState.setState.bind(appState);
        appState.setState = function(key, value, options) {
            console.log(`📊 State update: ${key} =`, value);
            return originalSetState(key, value, options);
        };
    }

    // Set up data flow coordination
    setupDataFlowCoordination();

    console.log('✅ All managers initialized with reactive state management');
});

/**
 * Set up coordination between different data sources
 */
function setupDataFlowCoordination() {
    // Example: When image updates, also refresh weather overlay position
    appState.subscribe('image.url', () => {
        // Could trigger overlay repositioning or other UI updates
        console.log('📸 Image updated, coordinating related updates...');
    });

    // Example: Coordinate error states across components
    appState.subscribe('ui.errors', (errors) => {
        const errorTypes = errors.map(e => e.type);
        console.log('⚠️ Active errors:', errorTypes);

        // Could disable certain features when critical errors occur
        if (errorTypes.includes('weather') && errorTypes.includes('image')) {
            console.log('🚨 Critical systems experiencing errors');
        }
    });

    // Example: Activity-based optimizations
    appState.subscribe('app.lastActivity', (lastActivity) => {
        const timeSinceActivity = Date.now() - lastActivity;
        if (timeSinceActivity < 1000) {
            // Recent activity - could increase refresh rates
            console.log('🔄 Recent activity detected');
        }
    });

    // Data freshness monitoring
    setInterval(() => {
        const imageTime = appState.getState('image.lastUpdate');
        const weatherTime = appState.getState('weather.lastUpdate');
        const now = Date.now();

        // Log data freshness
        if (imageTime && weatherTime) {
            const imageAge = Math.floor((now - imageTime) / 1000);
            const weatherAge = Math.floor((now - weatherTime) / 1000);
            console.log(`📊 Data age: Image ${imageAge}s, Weather ${weatherAge}s`);
        }
    }, 30000); // Every 30 seconds
}
