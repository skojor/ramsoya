// Solar events management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class SolarManager {
    constructor() {
        this.nextSunEventEl = document.getElementById("nextSunEvent");

        // Cache last solar payload to avoid re-rendering identical data
        this._lastSolarJson = null;

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Update UI when solar data changes
        appState.subscribe('astronomy.solar', (solarData) => {
            // Skip rendering if payload hasn't changed (prevents flicker on tab activation)
            const json = solarData ? JSON.stringify(solarData) : null;
            if (json === this._lastSolarJson) return;
            this._lastSolarJson = json;

            if (solarData) {
                this.renderSolarEvents(solarData);
            } else {
                UIComponents.updateContent(this.nextSunEventEl, '<div class="sun-error">Ingen soldata tilgjengelig</div>');
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates && typeof loadingStates === 'object' && 'solar' in loadingStates) {
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
            // Add null checks for event properties
            if (!event || !event.iso || !event.dayLabel || !event.label || !event.icon) {
                console.warn('Incomplete solar event data:', event);
                return; // Skip this event
            }

            const eventTime = new Date(event.iso);

            // Validate that the date is valid
            if (isNaN(eventTime.getTime())) {
                console.warn('Invalid date in solar event:', event.iso);
                return; // Skip this event
            }

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
