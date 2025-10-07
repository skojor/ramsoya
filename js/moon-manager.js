// Moon phase management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { reportError } from './error-handler.js';

export class MoonManager {
    constructor() {
        this.moonSvg = document.getElementById("moonSvg");
        this.moonText = document.getElementById("moonText");

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Update UI when moon data changes
        appState.subscribe('astronomy.moon', (moonData) => {
            if (moonData) {
                this.renderMoonData(moonData);
            }
        });
    }

    renderMoonData(data) {
        if (data.processed) {
            this.moonSvg.innerHTML = data.processed.svg;
            this.moonSvg.setAttribute("viewBox", "0 0 120 120");
            this.moonText.textContent = data.processed.text;
        } else {
            this.moonText.textContent = "Kunne ikke behandle månedata";
            this.showFallbackMoon();
        }
    }

    showFallbackMoon() {
        this.moonSvg.innerHTML = '<circle cx="60" cy="60" r="60" fill="#1e2228"/><circle cx="60" cy="60" r="59.4" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>';
        this.moonSvg.setAttribute("viewBox", "0 0 120 120");
    }

    async fetchMoon() {
        try {
            const res = await fetch(CONFIG.MOON_URL, { cache: "no-cache" });
            const data = await res.json();

            if (data.processed) {
                // Update state instead of direct rendering
                appState.setState('astronomy.moon', data);
            } else {
                reportError('moon', 'Unexpected moon data format', 'Missing processed data');
                appState.setState('astronomy.moon', { processed: null });
            }
        } catch (error) {
            reportError('moon', error, 'Failed to fetch moon phase data');
            appState.setState('astronomy.moon', null);
            this.moonText.textContent = "Kunne ikke hente månefasen nå.";
            this.showFallbackMoon();
        }
    }
}
