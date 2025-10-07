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
            setInterval(() => this.imageManager.refreshImage(), CONFIG.INTERVALS.IMAGE_REFRESH),
            setInterval(() => this.weatherManager.fetchWeather(), CONFIG.INTERVALS.WEATHER_REFRESH),
            setInterval(() => this.imageManager.updateStatus(), CONFIG.INTERVALS.IMAGE_STATUS),
            setInterval(() => this.moonManager.fetchMoon(), CONFIG.INTERVALS.MOON_REFRESH),
            setInterval(() => this.forecastManager.loadForecastHourly(), CONFIG.INTERVALS.FORECAST_REFRESH),
            setInterval(() => this.solarManager.loadSunriseSunset(), CONFIG.INTERVALS.SOLAR_REFRESH)
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
