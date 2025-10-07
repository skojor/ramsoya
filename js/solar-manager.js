// Solar events management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class SolarManager {
    constructor() {
        this.nextSunEventEl = document.getElementById("nextSunEvent");

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Update UI when solar data changes
        appState.subscribe('astronomy.solar', (solarData) => {
            if (solarData) {
                this.renderSolarEvents(solarData);
            } else {
                UIComponents.updateContent(this.nextSunEventEl, '<div class="sun-error">Ingen soldata tilgjengelig</div>');
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.solar !== undefined) {
                this.updateLoadingState(loadingStates.solar);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.nextSunEventEl, '<div class="sun-loading">Laster soldata...</div>');
        }
    }

    formatAllSolarEvents(data) {
        // Check if we have any solar event data
        if (!data || !data.events || !Array.isArray(data.events) || data.events.length === 0) {
            return '<div class="sun-error">Ingen soldata tilgjengelig</div>';
        }

        // Display all upcoming events
        let html = '';

        data.events.forEach((event, index) => {
            const eventTime = new Date(event.iso);
            const timeStr = eventTime.toLocaleTimeString('no-NO', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: CONFIG.TZ_OSLO
            });

            // Add some spacing between events
            if (index > 0) {
                html += '<div class="sun-separator"></div>';
            }

            html += `
                <div class="sun-event">
                    <img src="ikoner/${event.icon}" alt="${event.label}" class="sun-icon">
                    <div class="sun-info">
                        <div class="sun-label">${event.label} ${event.dayLabel.toLowerCase()}</div>
                        <div class="sun-time">${timeStr}</div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    renderSolarEvents(data) {
        this.nextSunEventEl.innerHTML = this.formatAllSolarEvents(data);
    }

    async loadSunriseSunset() {
        try {
            const data = await apiClient.get(CONFIG.SUNRISE_URL, 'solar');

            if (data) {
                // Update state instead of direct rendering
                appState.setState('astronomy.solar', data);
            } else {
                console.warn('No solar data received');
                appState.setState('astronomy.solar', null);
            }

        } catch (error) {
            console.error("Solar fetch error:", error);
            appState.setState('astronomy.solar', null);
            UIComponents.updateContent(this.nextSunEventEl, '<div class="sun-error">Kunne ikke hente soldata</div>');
        }
    }
}
