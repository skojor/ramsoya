// Entur public transport data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class EnturManager {
    constructor() {
        this.apiUrl = CONFIG.ENDPOINTS.ENTUR;
        this.refreshMs = CONFIG.INTERVALS.ENTUR_REFRESH;

        this.iconPin = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;

        this.elements = {
            dep: () => document.getElementById("entur-next-dep"),
            updated: () => document.getElementById("entur-updated")
        };

        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Update UI when transport data changes
        appState.subscribe('transport.entur', (enturData) => {
            if (enturData) {
                this.renderBidirectionalDepartures(enturData);
            } else {
                UIComponents.updateContent(this.elements.dep(), 'Ingen avganger funnet');
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.entur !== undefined) {
                this.updateLoadingState(loadingStates.entur);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.elements.dep(), 'Laster ruteinfo...');
        }
    }

    init() {
        console.log('Initializing Entur integration...');
        this.updateEntur();
        setInterval(() => this.updateEntur(), this.refreshMs);
    }

    async updateEntur() {
        try {
            console.log('Entur: Fetching from', this.apiUrl);
            const data = await apiClient.get(this.apiUrl, 'entur');
            console.log('Entur: Raw response received:', data);

            // Handle both null responses and proper data structure
            let enturData = null;
            if (data === null) {
                console.warn('Entur API returned empty response');
                enturData = null;
            } else if (data && typeof data === 'object') {
                console.log('Entur: Checking data structure, keys:', Object.keys(data));

                // Handle wrapped response format {success: true, data: {...}}
                if (data.success && data.data) {
                    console.log('Entur: Found wrapped response format');
                    enturData = data.data; // Extract the actual data
                    enturData.updated = data.updated; // Preserve the updated timestamp
                }
                // Handle direct format with expected properties
                else if (data.bidirectionalDepartures || data.stopRamsoyUrl || data.stopSandviksUrl) {
                    console.log('Entur: Found direct response format');
                    enturData = data;
                }
                // Handle other possible formats
                else if (data.departures || data.error) {
                    console.log('Entur: Found alternative response format');
                    enturData = data;
                } else {
                    console.warn('Entur: Unexpected data structure. Keys:', Object.keys(data), 'Data:', data);
                    enturData = null;
                }
            } else {
                console.warn('Entur: Unexpected response type:', typeof data, data);
                enturData = null;
            }

            if (enturData) {
                console.log('Entur: Setting state with valid data:', enturData);
                appState.setState('transport.entur', enturData);
                UIComponents.updateContent(this.elements.updated(), `oppdatert ${this.fmtUpdated()}`);
            } else {
                console.warn('Entur: No valid data received, setting null state');
                appState.setState('transport.entur', null);
                UIComponents.updateContent(this.elements.updated(), 'ingen data');
            }

        } catch (error) {
            console.error("Entur fetch error:", error);
            appState.setState('transport.entur', null);
            UIComponents.updateContent(this.elements.updated(), 'feil ved oppdatering');
        }
    }

    fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, "0");
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    formatTime(isoString) {
        if (!isoString) return '—';
        const depTime = new Date(isoString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const depDate = new Date(depTime.getFullYear(), depTime.getMonth(), depTime.getDate());

        const timeStr = new Intl.DateTimeFormat('nb-NO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: CONFIG.TZ_OSLO
        }).format(depTime);

        if (depDate.getTime() === today.getTime()) {
            return timeStr;
        } else if (depDate.getTime() === tomorrow.getTime()) {
            return timeStr + ' <span class="badge-tomorrow">(i morgen)</span>';
        } else {
            const dayStr = new Intl.DateTimeFormat('nb-NO', {
                weekday: 'short',
                day: 'numeric',
                timeZone: CONFIG.TZ_OSLO
            }).format(depTime);
            return timeStr + ' <span class="badge-tomorrow">(' + dayStr + ')</span>';
        }
    }

    renderBidirectionalDepartures(data) {
        console.log('Rendering Entur departures:', data);

        const {bidirectionalDepartures, stopRamsoyUrl, stopSandviksUrl, updated} = data;

        if (!bidirectionalDepartures || bidirectionalDepartures.length === 0) {
            this.elements.dep().innerHTML = '<div>Ingen avganger funnet</div>';
            return;
        }

        let html = '';

        bidirectionalDepartures.forEach(item => {
            const dep = item.departure;
            const direction = item.direction;
            const isVerified = item.verified;
            const isFallback = item.isFallback || false;

            // Fix: Handle both "Ramsøy" and "Ramsy" (typo in API response)
            const isFromRamsoy = direction.includes('Ramsy →') || direction.includes('Ramsøy →');
            const stopUrl = isFromRamsoy ? stopRamsoyUrl : stopSandviksUrl;
            const actionBtn = `<a class="iconbtn" href="${stopUrl}" target="_blank" rel="noopener" title="Åpne i Entur – ${direction}">${this.iconPin}</a>`;

            // Format departure time
            const depTimeFormatted = this.formatTime(dep.time);

            // Format on-time status with enhanced logic
            let onTimeStatus = '';
            if (dep.onTimeStatus) {
                onTimeStatus = ` (${dep.onTimeStatus})`;
            }

            // Format arrival info with verification status
            let arrivalInfo = '';
            if (dep.arrivalTime && dep.arrivalTime !== dep.time) {
                const arrivalTimeFormatted = this.formatTime(dep.arrivalTime);
                // Extract destination from direction for arrival info
                const destination = direction.includes('Sandviksberget') ? 'Sandviksberget' : 'Ramsøy';
                arrivalInfo = ` • Ankomst ${destination} ${arrivalTimeFormatted}`;
            }

            // Add fallback note if this is unverified route data
            let fallbackNote = '';
            if (isFallback && !isVerified) {
                const tooltip = 'title="Entur mangler informasjon om mellomstopp, så anløpet kan ikke bekreftes."';
                fallbackNote = ` • <span ${tooltip}>anløp ikke bekreftet</span>`;
            }

            // Build the complete line with enhanced status information
            html += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.4rem 0px;">`;
            html += `<span><strong style="color:#a9b3bd;font-weight:600;margin-right:.3rem;">${direction}:</strong> ${depTimeFormatted} – ${dep.destination}${onTimeStatus}${arrivalInfo}${fallbackNote}</span>`;
            html += `<div class="row-actions">${actionBtn}</div>`;
            html += `</div>`;
        });

        console.log('Generated HTML:', html);
        this.elements.dep().innerHTML = html;
        this.elements.updated().textContent = `oppdatert ${updated}`;
    }
}
