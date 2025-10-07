// Main application initialization
import { CONFIG } from './constants.js';
import { ImageManager } from './image-manager.js';
import { WeatherManager } from './weather-manager.js';
import { MoonManager } from './moon-manager.js';
import { ForecastManager } from './forecast-manager.js';
import { SolarManager } from './solar-manager.js';

export class WeatherApp {
    constructor() {
        // Managers now initialize themselves and handle their own fetch cycles
        this.imageManager = new ImageManager();
        this.weatherManager = new WeatherManager();
        this.moonManager = new MoonManager();
        this.forecastManager = new ForecastManager();
        this.solarManager = new SolarManager();
    }

    init() {
        // Managers now handle their own initialization, but we can trigger initial loads
        this.triggerInitialLoads();
        this.setupEventListeners();
    }

    triggerInitialLoads() {
        // Manually trigger initial data fetches
        this.imageManager.fetchImage();
        this.weatherManager.fetchWeather();
        this.moonManager.fetchMoon();
        this.forecastManager.loadForecastHourly();
        this.solarManager.loadSunriseSunset();
    }

    setupEventListeners() {
        // Refresh data when window regains focus
        window.addEventListener("focus", () => {
            this.triggerInitialLoads();
        });

        // Cleanup if needed (managers handle their own intervals now)
        window.addEventListener("beforeunload", () => {
            // Managers handle their own cleanup
        });
    }
}

// Export the class but don't initialize here - let main.js handle it
