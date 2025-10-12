// Tidal data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { UIComponents } from './ui-components.js';
import { visibilityManager } from './visibility-manager.js';
import { ApiClient } from './api-client.js';
import { formatTimeOslo } from './utils.js';

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
                UIComponents.updateContent(this.elements.tideNext1(), '\u2014');
                UIComponents.updateContent(this.elements.tideNext2(), '\u2014');
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

    norskType(t) {
        if (!t) return "";
        const key = String(t).toLowerCase();
        if (key === 'high' || key === 'flo' || key === 'highwater') return 'Flo';
        if (key === 'low' || key === 'fj\u00e6re' || key === 'lowwater') return 'Fj\u00e6re';
        return key;
    }

    fmtTid(d) {
        // Use explicit Europe/Oslo formatting
        return formatTimeOslo(d);
    }

    fmtM(cm) {
        return (cm / 100).toFixed(1) + 'm';
    }

    renderTidalData(tidalData) {
        const [a, b] = tidalData;

        if (a) {
            UIComponents.updateContent(this.elements.tideNext1(),
                `${this.norskType(a.type)}${a.type ? " " : ""}${this.fmtTid(a.time)} (${this.fmtM(a.cm)})`);
        } else {
            UIComponents.updateContent(this.elements.tideNext1(), '\u2014');
        }

        if (b) {
            UIComponents.updateContent(this.elements.tideNext2(),
                `${this.norskType(b.type)}${b.type ? " " : ""}${this.fmtTid(b.time)} (${this.fmtM(b.cm)})`);
        } else {
            UIComponents.updateContent(this.elements.tideNext2(), '\u2014');
        }
    }



    async loadTidalData() {
        try {
            const url = CONFIG.ENDPOINTS.TIDAL;
            // Use apiClient to fetch tidal data (now expects JSON)
            const result = await this.apiClient.get(url, 'tidal');

            // If API provided serverNowMs, store global server time for correctedNow
            const serverNowCandidate = result?.serverNowMs ?? result?.data?.serverNowMs;
            if (serverNowCandidate !== undefined && serverNowCandidate !== null) {
                const serverNow = Number(serverNowCandidate);
                if (!Number.isNaN(serverNow) && Number.isFinite(serverNow)) {
                    appState.setState('server.nowMs', serverNow, { silent: true });
                    appState.setState('server.clockDeltaMs', Date.now() - serverNow, { silent: true });
                }
            }

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
