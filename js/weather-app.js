// Main application initialization
import { CONFIG } from './constants.js';
import { ImageManager } from './image-manager.js';
import { WeatherManager } from './weather-manager.js';
import { MoonManager } from './moon-manager.js';
import { ForecastManager } from './forecast-manager.js';
import { SolarManager } from './solar-manager.js';

export class WeatherApp {
    constructor() {
        this.imageManager = new ImageManager();
        this.weatherManager = new WeatherManager();
        this.moonManager = new MoonManager();
        this.forecastManager = new ForecastManager();
        this.solarManager = new SolarManager();
        this.timers = [];
    }

    init() {
        // Initial loads
        this.imageManager.refreshImage();
        this.weatherManager.fetchWeather();
        this.moonManager.fetchMoon();
        this.forecastManager.loadForecastHourly();
        this.solarManager.loadSunriseSunset();
        this.imageManager.updateStatus();

        // Set up timers
        this.setupTimers();
        this.setupEventListeners();
    }

    setupTimers() {
        this.timers.push(
            setInterval(() => this.imageManager.refreshImage(), CONFIG.IMAGE_INTERVAL_MS),
            setInterval(() => this.weatherManager.fetchWeather(), CONFIG.WEATHER_INTERVAL_MS),
            setInterval(() => this.imageManager.updateStatus(), 1000),
            setInterval(() => this.moonManager.fetchMoon(), 15 * 60_000),
            setInterval(() => this.forecastManager.loadForecastHourly(), 30 * 60_000),
            setInterval(() => this.solarManager.loadSunriseSunset(), 30 * 60_000)
        );
    }

    setupEventListeners() {
        window.addEventListener("focus", () => {
            this.imageManager.refreshImage();
            this.weatherManager.fetchWeather();
            this.moonManager.fetchMoon();
            this.forecastManager.loadForecastHourly();
            this.solarManager.loadSunriseSunset();
        });

        window.addEventListener("beforeunload", () => {
            this.timers.forEach(timer => clearInterval(timer));
        });
    }
}

// Export the class but don't initialize here - let main.js handle it
