// Main application initialization
class WeatherApp {
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new WeatherApp();
    app.init();
});
