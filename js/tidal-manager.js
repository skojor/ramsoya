// Tidal data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { UIComponents } from './ui-components.js';
import { visibilityManager } from './visibility-manager.js';
import { ApiClient } from './api-client.js';

export class TidalManager {
    constructor() {
        this.refreshMs = CONFIG.INTERVALS.TIDAL_REFRESH;

        this.elements = {
            tideNext1: () => document.getElementById('tideNext1'),
            tideNext2: () => document.getElementById('tideNext2')
        };

        this.apiClient = new ApiClient();

        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Update UI when tidal data changes
        appState.subscribe('location.tidal', (tidalData) => {
            if (tidalData) {
                this.renderTidalData(tidalData);
            } else {
                UIComponents.updateContent(this.elements.tideNext1(), '—');
                UIComponents.updateContent(this.elements.tideNext2(), '—');
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.tidal !== undefined) {
                this.updateLoadingState(loadingStates.tidal);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.elements.tideNext1(), 'Laster...');
            UIComponents.updateContent(this.elements.tideNext2(), 'Laster...');
        }
    }

    init() {
        // Initial load
        this.loadTidalData().catch(error => {
            console.error('Failed to load initial tidal data:', error);
        });

        // Setup visibility-aware interval for tidal updates
        visibilityManager.setInterval('tidal',
            () => this.loadTidalData().catch(error => {
                console.error('Failed to load tidal data during interval:', error);
            }),
            this.refreshMs,
            1.5 // 1.5x slower when hidden (30min -> 45min) - tidal changes are predictable
        );
    }

    isoLocal(d) {
        const p = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Oslo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(d);
        const g = t => p.find(x => x.type === t).value;
        return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
    }

    norskType(t) {
        if (!t) return "";
        const key = String(t).toLowerCase();
        if (key === 'high' || key === 'flo' || key === 'highwater') return 'Flo';
        if (key === 'low' || key === 'fjære' || key === 'lowwater') return 'Fjære';
        return key;
    }

    fmtTid(d) {
        return d.toLocaleTimeString('no-NO', {hour: '2-digit', minute: '2-digit'});
    }

    fmtM(cm) {
        return (cm / 100).toFixed(2) + ' m';
    }

    renderTidalData(tidalData) {
        const [a, b] = tidalData;

        if (a) {
            UIComponents.updateContent(this.elements.tideNext1(),
                `${this.norskType(a.type)}${a.type ? " " : ""}${this.fmtTid(a.time)} (${this.fmtM(a.cm)})`);
        } else {
            UIComponents.updateContent(this.elements.tideNext1(), '—');
        }

        if (b) {
            UIComponents.updateContent(this.elements.tideNext2(),
                `${this.norskType(b.type)}${b.type ? " " : ""}${this.fmtTid(b.time)} (${this.fmtM(b.cm)})`);
        } else {
            UIComponents.updateContent(this.elements.tideNext2(), '—');
        }
    }



    async loadTidalData() {
        try {
            const url = CONFIG.ENDPOINTS.TIDAL;
            // Use apiClient to fetch tidal data (now expects JSON)
            const result = await this.apiClient.get(url, 'tidal');

            let tidalEvents = [];
            if (result && Array.isArray(result.events) && result.events.length > 0) {
                // Convert time strings to Date objects
                tidalEvents = result.events.map(ev => ({
                    ...ev,
                    time: new Date(ev.time)
                }));
            } else {
                console.warn('Tidal: No events found, setting null state');
            }

            if (tidalEvents.length > 0) {
                appState.setState('location.tidal', tidalEvents.slice(0, 2));
            } else {
                appState.setState('location.tidal', null);
            }
        } catch (error) {
            console.error("Tidal fetch error:", error);
            appState.setState('location.tidal', null);
        }
    }

}
