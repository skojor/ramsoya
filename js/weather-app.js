// Main application initialization
import { CONFIG } from './constants.js';
import { ImageManager } from './image-manager.js';
import { WeatherManager } from './weather-manager.js';
import { MoonManager } from './moon-manager.js';
import { ForecastManager } from './forecast-manager.js';
import { SolarManager } from './solar-manager.js';
import { visibilityManager } from './visibility-manager.js';

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
        // Setup visibility-aware intervals instead of direct manager intervals
        this.setupSmartIntervals();
        this.triggerInitialLoads();
        this.setupEventListeners();
    }

    setupSmartIntervals() {

        // Weather updates - frequent, moderate reduction when hidden
        visibilityManager.setInterval('weather',
            () => this.weatherManager.fetchWeather(),
            CONFIG.INTERVALS.WEATHER_REFRESH,
            3 // 3x slower when hidden (30s -> 90s)
        );

        // Moon data - less frequent, minimal reduction needed
        visibilityManager.setInterval('moon',
            () => this.moonManager.fetchMoon(),
            CONFIG.INTERVALS.MOON_REFRESH,
            2 // 2x slower when hidden (15min -> 30min)
        );

        // Forecast - moderate frequency
        visibilityManager.setInterval('forecast',
            () => this.forecastManager.loadForecastHourly(),
            CONFIG.INTERVALS.FORECAST_REFRESH,
            2 // 2x slower when hidden (30min -> 60min)
        );

        // Solar events - least frequent updates needed
        visibilityManager.setInterval('solar',
            () => this.solarManager.loadSunriseSunset(),
            CONFIG.INTERVALS.SOLAR_REFRESH,
            1.5 // Minimal reduction (30min -> 45min)
        );
    }

    triggerInitialLoads() {
        // Manually trigger initial data fetches
        this.imageManager.refreshImage();
        this.weatherManager.fetchWeather();
        this.moonManager.fetchMoon();
        this.forecastManager.loadForecastHourly();
        this.solarManager.loadSunriseSunset();
    }

    setupEventListeners() {

        window.addEventListener("focus", () => {
            try {
                this.imageManager.refreshImage();
            } catch (err) { /* ignore */ }
            try {
                this.weatherManager.fetchWeather();
            } catch (err) { /* ignore */ }
            try {
                this.moonManager.fetchMoon();
            } catch (err) { /* ignore */ }
            try {
                this.forecastManager.loadForecastHourly();
            } catch (err) { /* ignore */ }
        });

        // Cleanup intervals on unload
        window.addEventListener("beforeunload", () => {
            visibilityManager.pauseAll();
        });
    }
}

// Export the class but don't initialize here - let main.js handle it
