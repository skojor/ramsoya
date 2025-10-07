// Tidal data management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
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
            console.log('Tidal: Fetching from URL:', url);

            // Use direct fetch since tidal API returns XML/text, not JSON
            const response = await fetch(url, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('Tidal: Raw response length:', responseText.length);
            console.log('Tidal: Raw response preview (first 200 chars):', responseText.substring(0, 200));

            // Handle both null responses and text responses
            let tidalEvents = [];
            if (!responseText || responseText.trim().length === 0) {
                console.warn('Tidal API returned empty response');
                tidalEvents = [];
            } else {
                // Parse tidal data from XML/text response
                tidalEvents = this.parseTidalResponse(responseText);
                console.log('Tidal: Parsed events count:', tidalEvents.length);
                console.log('Tidal: Parsed events:', tidalEvents);
            }

            if (tidalEvents && tidalEvents.length > 0) {
                console.log('Tidal: Setting state with', tidalEvents.length, 'events');
                appState.setState('location.tidal', tidalEvents.slice(0, 2));
            } else {
                console.warn('Tidal: No events found, setting null state');
                appState.setState('location.tidal', null);
            }

        } catch (error) {
            console.error("Tidal fetch error:", error);
            appState.setState('location.tidal', null);
        }
    }

    parseTidalResponse(responseText) {
        console.log('Tidal: Starting to parse response...');
        if (typeof responseText !== 'string') {
            console.warn('Tidal: Response is not a string:', typeof responseText);
            return [];
        }

        // First, let's check if this is XML format
        if (responseText.includes('<tide>') || responseText.includes('<?xml')) {
            console.log('Tidal: Response appears to be XML format');
            return this.parseXmlTidalResponse(responseText);
        }

        // Otherwise, try tab-separated format
        console.log('Tidal: Trying tab-separated format');
        const lines = responseText.split('\n').filter(line => line.trim().length > 0);
        console.log('Tidal: Found', lines.length, 'non-empty lines');
        const events = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            console.log(`Tidal: Processing line ${i}:`, line);
            const parts = line.split('\t');

            if (parts.length >= 3) {
                try {
                    const timeStr = parts[0];
                    const type = parts[1];
                    const cmStr = parts[2];

                    console.log(`Tidal: Parsing - time: "${timeStr}", type: "${type}", cm: "${cmStr}"`);

                    const time = new Date(timeStr);
                    const cm = parseFloat(cmStr);

                    if (!isNaN(time.getTime()) && !isNaN(cm)) {
                        events.push({ time, type, cm });
                        console.log('Tidal: Successfully parsed event:', { time: time.toISOString(), type, cm });
                    } else {
                        console.warn('Tidal: Failed to parse time/cm values:', { time: time.toISOString(), cm });
                    }
                } catch (e) {
                    console.warn('Tidal: Failed to parse line:', line, e);
                }
            } else {
                console.log(`Tidal: Skipping line with ${parts.length} parts:`, line);
            }
        }

        console.log('Tidal: Final parsed events:', events);
        return events.sort((a, b) => a.time - b.time);
    }

    parseXmlTidalResponse(responseText) {
        console.log('Tidal: Parsing XML response...');
        const events = [];

        try {
            // Simple XML parsing for tidal data
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(responseText, 'text/xml');

            const dataElements = xmlDoc.querySelectorAll('data');
            console.log('Tidal: Found', dataElements.length, 'data elements in XML');

            dataElements.forEach((dataEl, index) => {
                const time = dataEl.getAttribute('time');
                const type = dataEl.getAttribute('flag'); // or 'type' depending on XML structure
                const value = dataEl.getAttribute('value');

                console.log(`Tidal XML element ${index}:`, { time, type, value });

                if (time && value) {
                    const parsedTime = new Date(time);
                    const cm = parseFloat(value) * 100; // Convert to cm if needed

                    if (!isNaN(parsedTime.getTime()) && !isNaN(cm)) {
                        events.push({
                            time: parsedTime,
                            type: type || 'unknown',
                            cm
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Tidal: XML parsing failed:', error);
        }

        console.log('Tidal: XML parsed events:', events);
        return events.sort((a, b) => a.time - b.time);
    }
}
