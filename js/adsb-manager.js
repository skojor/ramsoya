// ADSB aircraft tracking management
import { CONFIG } from './constants.js';
import { ensureTooltip, positionTooltip } from './tooltip-helpers.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';
import { visibilityManager } from './visibility-manager.js';

export class ADSBManager {
    constructor() {
        this.endpoint = CONFIG.ENDPOINTS.ADSB;
        this.refreshMs = CONFIG.INTERVALS.ADSB_REFRESH;
        this.iconPlane = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.56 3.44C21.15 4.03 21.15 4.97 20.56 5.56L5.56 20.56C4.97 21.15 4.03 21.15 3.44 20.56C2.85 19.97 2.85 19.03 3.44 18.44L18.44 3.44C19.03 2.85 19.97 2.85 20.56 3.44M8.5 7.5L12 11L13 10L9.5 6.5L8.5 7.5M16.5 15.5L17.5 16.5L14 20L13 19L16.5 15.5Z"/></svg>`;

        // DOM element getters
        this.elements = {
            tbody: () => document.querySelector("#adsb-table tbody"),
            count: () => document.getElementById("adsb-count"),
            updated: () => document.getElementById("adsb-updated"),
            empty: () => document.getElementById("adsb-empty"),
            error: () => document.getElementById("adsb-error"),
            wrap: () => document.getElementById("adsb-table-wrap"),
            table: () => document.getElementById("adsb-table")
        };

        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Re-render when ADSB data changes
        appState.subscribe('location.adsb', (aircraft) => {
            this.renderAircraft(aircraft);
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.adsb !== undefined) {
                this.updateLoadingState(loadingStates.adsb);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.elements.updated(), 'oppdaterer...');
        }
    }

    init() {
        // Initial load
        this.loadAdsb();

        // Setup visibility-aware interval for real-time aircraft tracking
        visibilityManager.setInterval('adsb',
            () => this.loadAdsb(),
            this.refreshMs,
            3 // 3x slower when hidden (20s -> 60s) - aircraft move faster than ships
        );
    }

    fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, "0");
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    makeTooltipText(a) {
        const alt = (typeof a.alt_ft === "number") ? `${a.alt_ft} ft` : "–";
        const spd = (typeof a.spd_kn === "number") ? `${a.spd_kn.toFixed(1)} kn` : "–";
        const track = (a.track_deg != null) ? `${a.track_deg}°` : "–";
        const nm = (typeof a.dist_nm === "number") ? `${a.dist_nm.toFixed(1)} nm` : "–";
        const vs = (typeof a.vs_fpm === "number") ? `${a.vs_fpm > 0 ? '+' : ''}${a.vs_fpm} fpm` : "–";

        return `Kallesignal: ${a.callsign || "–"}\nFlytype: ${a.aircraft_type || "–"}\nHøyde: ${alt}\nFart: ${spd}\nKurs: ${track}\nStiging: ${vs}\nAvstand: ${nm}\nSist sett: ${a.tid || "–"}`;
    }

    flightAwareUrl(callsign) {
        if (!callsign) return null;
        return `${CONFIG.EXTERNAL.FLIGHT_AWARE}${encodeURIComponent(callsign)}`;
    }

    renderAircraft(aircraft) {

        const hasRows = aircraft.length > 0;
        UIComponents.toggleElement(this.elements.wrap(), hasRows);
        UIComponents.toggleElement(this.elements.empty(), !hasRows);

        // Update count with multiple fallback methods
        const count = aircraft.length;

        // Method 1: Try UIComponents
        const countElement = this.elements.count();
        if (countElement) {
            UIComponents.updateContent(countElement, count);
        } else {
            console.error('Count element not found via this.elements.count()!');
        }

        // Method 2: Direct DOM fallback to ensure it works
        const directCountElement = document.getElementById('adsb-count');
        if (directCountElement) {
            directCountElement.textContent = count.toString();
        } else {
            console.error('Count element not found via direct DOM query!');
        }

        UIComponents.updateContent(this.elements.updated(), `oppdatert ${this.fmtUpdated()}`);

        if (hasRows) {
            this.renderTable(aircraft);
        }
    }

    renderTable(aircraft) {
        // Convert aircraft data to table format
        const tableData = aircraft.map(a => {
            const flightNumber = a.flight || a.callsign || "–";
            const airline = a.airline || "–";

            const actions = flightNumber !== "–" ?
                `<a class="iconbtn" href="${this.flightAwareUrl(flightNumber)}" target="_blank" rel="noopener" title="Åpne i FlightAware" onclick="event.stopPropagation()">${this.iconPlane}</a>` : '';

            // Format 'Sist sett' (last seen) as a readable time string if possible
            let lastSeen = "–";
            if (a.tid) {
                // Try to parse as ISO or epoch seconds
                let dateObj;
                if (typeof a.tid === 'number') {
                    // Assume epoch seconds
                    dateObj = new Date(a.tid * 1000);
                } else if (typeof a.tid === 'string') {
                    // Try ISO or fallback
                    const parsed = Date.parse(a.tid);
                    if (!isNaN(parsed)) {
                        dateObj = new Date(parsed);
                    }
                }
                if (dateObj instanceof Date && !isNaN(dateObj)) {
                    const pad = n => String(n).padStart(2, "0");
                    lastSeen = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                }
            }

            return {
                flight: flightNumber,
                airline: airline,
                altitude: (typeof a.alt_ft === "number") ? `${a.alt_ft}` :
                         (typeof a.alt_baro === "number") ? `${a.alt_baro}` :
                         (typeof a.altitude === "number") ? `${a.altitude}` : "–",
                speed: (typeof a.spd_kn === "number") ? a.spd_kn.toFixed(1) :
                       (typeof a.gs === "number") ? a.gs.toFixed(1) :
                       (typeof a.speed === "number") ? a.speed.toFixed(1) : "–",
                track: (a.track_deg != null) ? `${a.track_deg}°` :
                       (a.track != null) ? `${a.track}°` : "–",
                distance: (typeof a.dist_nm === "number") ? a.dist_nm.toFixed(1) :
                         (typeof a.distance_nm === "number") ? a.distance_nm.toFixed(1) :
                         (typeof a.distance_km === "number") ? (a.distance_km / 1.852).toFixed(1) : "–",
                lastSeen: lastSeen,
                actions: actions,
                _aircraft: a // Keep reference for tooltip
            };
        });

        // Use headers that match the HTML table structure
        const headers = ['Flight', 'Flyselskap', 'Høyde (ft)', 'Fart (kt)', 'Retning', 'Avstand (nm)', 'Sist sett'];

        // Create table using UIComponents
        const tableEl = UIComponents.createTable({
            headers,
            rows: tableData.map(row => [
                row.flight,
                row.airline,
                row.altitude,
                row.speed,
                row.track,
                row.distance,
                row.lastSeen,
                row.actions
            ]),
            onRowClick: (rowData, index) => {
                const aircraft = tableData[index];
                if
