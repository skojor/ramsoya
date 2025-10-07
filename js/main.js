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

// Legacy global configuration for backward compatibility
window.WIND_FLIP = true;

// Initialize all manager classes when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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

    console.log('All managers initialized');
});
