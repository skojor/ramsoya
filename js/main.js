// Main entry point for the weather application
import './utils.js';
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
import { injectComponentStyles } from './ui-components.js';

// Legacy global configuration for backward compatibility
window.WIND_FLIP = CONFIG.WIND_FLIP;

// Initialize all manager classes when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Ramsøyvika Weather Station...');

    // Initialize UI components system
    injectComponentStyles();

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

        // Log state changes in development
        const originalSetState = appState.setState.bind(appState);
        appState.setState = function(key, value, options) {
            return originalSetState(key, value, options);
        };
    }

    console.log('✅ All systems initialized successfully');
});
