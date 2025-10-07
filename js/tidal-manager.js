// Tidal data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { reportError } from './error-handler.js';

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
            }
        });
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
        const el1 = this.elements.tideNext1();
        const el2 = this.elements.tideNext2();

        if (a) {
            el1.textContent = `${this.norskType(a.type)}${a.type ? " " : ""}${this.fmtTid(a.time)} (${this.fmtM(a.cm)})`;
        } else {
            el1.textContent = '—';
        }

        if (b) {
            el2.textContent = `${this.norskType(b.type)}${b.type ? " " : ""}${this.fmtTid(b.time)} (${this.fmtM(b.cm)})`;
        } else {
            el2.textContent = '—';
        }
    }

    async hentToNeste() {
        try {
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

            const res = await fetch(url, {cache: 'no-store'});

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: Failed to fetch tidal data`);
            }

            const xml = await res.text();
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const items = Array.from(doc.querySelectorAll('waterlevel')).slice(0, 2).map(el => ({
                type: el.getAttribute('type') ?? el.getAttribute('flag') ?? el.getAttribute('kind') ?? el.getAttribute('tide'),
                time: new Date(el.getAttribute('time')),
                cm: Number(el.getAttribute('value'))
            }));

            // Update state instead of direct rendering
            appState.setState('location.tidal', items);

        } catch (error) {
            reportError('tidal', error, 'Failed to fetch tidal data from Kartverket');
            appState.setState('location.tidal', null);
            this.elements.tideNext1().textContent = 'Feil ved henting';
            this.elements.tideNext2().textContent = '—';
        }
    }
}
