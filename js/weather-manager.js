// Weather overlay management
import { CONFIG } from './constants.js';
import { bust } from './utils.js';
import { appState } from './state-manager.js';

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
            if (weatherData) {
                this.renderWeather(weatherData);
            }
        });
    }

    renderWeather(data) {
        this.overlayEl.innerHTML = "";

        const wrap = (title, lines) => {
            const section = document.createElement("section");
            if (title) {
                const h = document.createElement("h3");
                h.textContent = title;
                section.appendChild(h);
            }
            if (Array.isArray(lines) && lines.length) {
                const ul = document.createElement("ul");
                for (const line of lines) {
                    const li = document.createElement("li");
                    li.textContent = String(line);
                    ul.appendChild(li);
                }
                section.appendChild(ul);
            }
            return section;
        };

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

        for (const block of normalized) {
            this.overlayEl.appendChild(wrap(block.title, block.lines));
        }

        this.overlayEl.hidden = this.overlayEl.childElementCount === 0;
    }

    async fetchWeather() {
        try {
            const res = await fetch(bust(CONFIG.WEATHER_URL), {
                headers: { "Accept": "application/json" },
                cache: "no-cache"
            });
            const text = await res.text();

            let json;
            try {
                json = JSON.parse(text);
            } catch {
                const cleaned = text.trim().replace(/^[\uFEFF]/, "").replace(/<\/?pre[^>]*>/gi, "");
                json = JSON.parse(cleaned);
            }

            // Update state instead of calling render directly
            appState.setState('weather.current', json);
            appState.setState('weather.lastUpdate', Date.now());
            this.lastWeatherTs = Date.now();
            this.updateStatus();
        } catch (e) {
            console.error("Værfeil:", e);
            appState.setState('weather.current', null);
            // Add error to global error state
            const errors = appState.getState('ui.errors') || [];
            errors.push({
                type: 'weather',
                message: e.message,
                timestamp: Date.now()
            });
            appState.setState('ui.errors', errors);
        }
    }

    updateStatus() {
        // Update status based on last weather fetch timestamp
        // This method can be expanded based on requirements
    }
}
