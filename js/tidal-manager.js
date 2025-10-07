// Tidal data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class TidalManager {
    constructor() {
        this.lat = CONFIG.LOCATION.LAT;
        this.lon = CONFIG.LOCATION.LON;
        this.refreshMs = CONFIG.INTERVALS.TIDAL_REFRESH;

        this.elements = {
            tideNext1: () => document.getElementById('tideNext1'),
            tideNext2: () => document.getElementById('tideNext2')
        };

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
        this.hentToNeste();
        setInterval(() => this.hentToNeste(), this.refreshMs);
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

    buildTidalUrl() {
        const now = new Date();
        const to = new Date(now.getTime() + 72 * 60 * 60 * 1000);
        const url = new URL(CONFIG.ENDPOINTS.TIDAL);
        url.search = new URLSearchParams({
            tide_request: 'locationdata',
            lat: String(this.lat),
            lon: String(this.lon),
            datatype: 'tab',
            refcode: 'cd',
            lang: 'nb',
            fromtime: this.isoLocal(now),
            totime: this.isoLocal(to),
            tzone: '1',
            dst: '1'
        }).toString();
        return url.toString();
    }

    async hentToNeste() {
        try {
            const url = this.buildTidalUrl();
            const responseText = await apiClient.fetch(url, { method: 'GET' }, 'tidal');

            // Handle both null responses and text responses
            let tidalEvents = [];
            if (responseText === null) {
                console.warn('Tidal API returned empty response');
                tidalEvents = [];
            } else if (typeof responseText === 'string' && responseText.trim().length > 0) {
                // Parse tidal data from text response
                tidalEvents = this.parseTidalResponse(responseText);
            } else {
                console.warn('Unexpected tidal response type:', typeof responseText);
                tidalEvents = [];
            }

            if (tidalEvents && tidalEvents.length > 0) {
                appState.setState('location.tidal', tidalEvents.slice(0, 2));
            } else {
                console.warn('No tidal events found');
                appState.setState('location.tidal', null);
            }

        } catch (error) {
            console.error("Tidal fetch error:", error);
            appState.setState('location.tidal', null);
        }
    }

    parseTidalResponse(responseText) {
        if (typeof responseText !== 'string') return [];

        const lines = responseText.split('\n').filter(line => line.trim().length > 0);
        const events = [];

        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 3) {
                try {
                    const timeStr = parts[0];
                    const type = parts[1];
                    const cmStr = parts[2];

                    const time = new Date(timeStr);
                    const cm = parseFloat(cmStr);

                    if (!isNaN(time.getTime()) && !isNaN(cm)) {
                        events.push({ time, type, cm });
                    }
                } catch (e) {
                    console.warn('Failed to parse tidal line:', line, e);
                }
            }
        }

        return events.sort((a, b) => a.time - b.time);
    }
}
