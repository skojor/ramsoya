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
        UIComponents.updateContent(this.elements.count(), aircraft.length);
        UIComponents.updateContent(this.elements.updated(), `oppdatert ${this.fmtUpdated()}`);

        if (hasRows) {
            this.renderTable(aircraft);
        }
    }

    renderTable(aircraft) {
        // Convert aircraft data to table format
        const tableData = aircraft.map(a => {
            const actions = a.callsign ?
                `<a class="iconbtn" href="${this.flightAwareUrl(a.callsign)}" target="_blank" rel="noopener" title="Åpne i FlightAware" onclick="event.stopPropagation()">${this.iconPlane}</a>` : '';

            return {
                callsign: a.callsign || "–",
                aircraft_type: a.aircraft_type || "–",
                altitude: (typeof a.alt_ft === "number") ? `${a.alt_ft}` : "–",
                speed: (typeof a.spd_kn === "number") ? a.spd_kn.toFixed(1) : "–",
                track: (a.track_deg != null) ? `${a.track_deg}°` : "–",
                distance: (typeof a.dist_nm === "number") ? a.dist_nm.toFixed(1) : "–",
                actions: actions,
                _aircraft: a // Keep reference for tooltip
            };
        });

        const headers = ['Kallesignal', 'Flytype', 'Høyde', 'Fart', 'Kurs', 'Avstand', ''];

        // Create table using UIComponents
        const tableEl = UIComponents.createTable({
            headers,
            rows: tableData.map(row => [
                row.callsign,
                row.aircraft_type,
                row.altitude,
                row.speed,
                row.track,
                row.distance,
                row.actions
            ]),
            onRowClick: (rowData, index) => {
                const aircraft = tableData[index];
                if (aircraft.callsign && aircraft._aircraft.callsign) {
                    window.open(this.flightAwareUrl(aircraft._aircraft.callsign), "_blank", "noopener");
                }
            }
        });

        // Add tooltip functionality
        this.addTooltipHandlers(tableEl, tableData);

        // Replace table content
        const tbody = this.elements.tbody();
        const table = tbody.closest('table');
        if (table && tableEl.querySelector('table')) {
            table.querySelector('tbody').innerHTML = tableEl.querySelector('tbody').innerHTML;
        }
    }

    addTooltipHandlers(tableEl, aircraftData) {
        const tooltip = ensureTooltip();
        const rows = tableEl.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
            const aircraft = aircraftData[index]._aircraft;

            row.addEventListener("mouseenter", e => {
                tooltip.textContent = this.makeTooltipText(aircraft);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
                positionTooltip(e, tooltip);
            });

            row.addEventListener("mousemove", e => {
                positionTooltip(e, tooltip);
            });

            row.addEventListener("mouseleave", () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            });
        });

        // Global cleanup handlers
        this.elements.table().addEventListener("mouseleave", () => {
            tooltip.hidden = true;
        }, {once: true});

        window.addEventListener("scroll", () => {
            tooltip.hidden = true;
        }, {passive: true});
    }

    async loadAdsb() {
        try {
            UIComponents.toggleElement(this.elements.error(), false);

            const data = await apiClient.get(this.endpoint, 'adsb');

            // Handle both null responses and proper data structure
            let aircraft = [];
            if (data === null) {
                console.warn('ADSB API returned empty response');
                aircraft = [];
            } else if (Array.isArray(data?.aircraft)) {
                aircraft = data.aircraft;
            } else if (Array.isArray(data)) {
                // Handle case where API returns array directly
                aircraft = data;
            } else {
                console.warn('Unexpected ADSB data structure:', data);
                aircraft = [];
            }

            // Update state instead of calling render directly
            appState.setState('location.adsb', aircraft);

        } catch (error) {
            console.error("ADSB fetch error:", error);
            appState.setState('location.adsb', []);
            UIComponents.toggleElement(this.elements.error(), true);
            UIComponents.updateContent(this.elements.updated(), "feil ved oppdatering");
        }
    }
}
