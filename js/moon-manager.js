// Moon phase management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

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

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.moon !== undefined) {
                this.updateLoadingState(loadingStates.moon);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.moonText, 'Laster månefase...');
        }
    }

    renderMoonData(data) {
        if (data.processed) {
            this.moonSvg.innerHTML = data.processed.svg;
            this.moonSvg.setAttribute("viewBox", "0 0 120 120");
            UIComponents.updateContent(this.moonText, data.processed.text);
        } else {
            UIComponents.updateContent(this.moonText, "Kunne ikke behandle månedata");
            this.showFallbackMoon();
        }
    }

    showFallbackMoon() {
        this.moonSvg.innerHTML = '<circle cx="60" cy="60" r="60" fill="#1e2228"/><circle cx="60" cy="60" r="59.4" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>';
        this.moonSvg.setAttribute("viewBox", "0 0 120 120");
    }

    async fetchMoon() {
        try {
            const data = await apiClient.get(CONFIG.MOON_URL, 'moon');

            // If API provided serverNowMs, store global server time for correctedNow
            const serverNowCandidate = data?.serverNowMs ?? data?.data?.serverNowMs;
            if (serverNowCandidate !== undefined && serverNowCandidate !== null) {
                const serverNow = Number(serverNowCandidate);
                if (!Number.isNaN(serverNow) && Number.isFinite(serverNow)) {
                    appState.setState('server.nowMs', serverNow, { silent: true });
                    appState.setState('server.clockDeltaMs', Date.now() - serverNow, { silent: true });
                }
            }

            if (data && data.processed) {
                // Update state instead of direct rendering
                appState.setState('astronomy.moon', data);
            } else {
                console.warn('Unexpected moon data format - missing processed data');
                appState.setState('astronomy.moon', { processed: null });
            }
        } catch (error) {
            console.error("Moon fetch error:", error);
            appState.setState('astronomy.moon', null);
            UIComponents.updateContent(this.moonText, "Kunne ikke hente månefasen nå.");
            this.showFallbackMoon();
        }
    }
}
