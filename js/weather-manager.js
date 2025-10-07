// Weather overlay management
import { CONFIG } from './constants.js';
import { bust } from './utils.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class WeatherManager {
    constructor() {
        this.overlayEl = document.getElementById("weatherOverlay");
        this.lastWeatherTs = 0;

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Re-render when weather data changes
        appState.subscribe('weather.current', (weatherData) => {
            this.renderWeather(weatherData);
        });

        // Show loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.weather !== undefined) {
                this.updateLoadingState(loadingStates.weather);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            const loader = UIComponents.createLoader('Henter værdata...');
            UIComponents.replaceContent(this.overlayEl, loader);
            this.overlayEl.hidden = false;
        }
    }

    renderWeather(data) {
        if (!data) {
            this.overlayEl.hidden = true;
            return;
        }

        const cards = [];
        const normalized = this.normalizeWeatherData(data);

        for (const block of normalized) {
            const card = UIComponents.createCard({
                title: block.title,
                content: block.lines,
                className: 'weather-card'
            });
            cards.push(card);
        }

        UIComponents.replaceContent(this.overlayEl, cards);
        this.overlayEl.hidden = cards.length === 0;
    }

    normalizeWeatherData(data) {
        const normalized = [];

        if (Array.isArray(data)) {
            for (const entry of data) {
                if (entry && typeof entry === "object" && "data" in entry) {
                    normalized.push({
                        title: entry.label || "",
                        lines: Array.isArray(entry.data) ? entry.data : [String(entry.data ?? "")]
                    });
                } else {
                    normalized.push({
                        title: "",
                        lines: [String(entry)]
                    });
                }
            }
        } else if (data && typeof data === "object" && "data" in data) {
            normalized.push({
                title: data.label || "",
                lines: Array.isArray(data.data) ? data.data : [String(data.data ?? "")]
            });
        } else if (data != null) {
            normalized.push({
                title: "",
                lines: [String(data)]
            });
        }

        return normalized;
    }

    async fetchWeather() {
        try {
            const weatherData = await apiClient.get(bust(CONFIG.WEATHER_URL), 'weather');

            if (weatherData) {
                appState.setState('weather.current', weatherData);
                appState.setState('weather.lastUpdate', Date.now());
                this.lastWeatherTs = Date.now();
                this.updateStatus();
            } else {
                console.warn('No weather data received');
                appState.setState('weather.current', null);
            }
        } catch (error) {
            console.error("Weather fetch error:", error);
            appState.setState('weather.current', null);

            // Show error in UI
            const errorEl = UIComponents.createError('Kunne ikke hente værdata', () => this.fetchWeather());
            UIComponents.replaceContent(this.overlayEl, errorEl);
            this.overlayEl.hidden = false;
        }
    }

    updateStatus() {
        // Update status based on last weather fetch timestamp
        // This method can be expanded based on requirements
    }
}
