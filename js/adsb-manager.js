// ADSB aircraft tracking management
import {CONFIG} from './constants.js';
import {ensureTooltip, positionTooltip, safeUrlFrom} from './utils.js';
import {appState} from './state-manager.js';
import {apiClient} from './api-client.js';
import {UIComponents} from './ui-components.js';
import {visibilityManager} from './visibility-manager.js';

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
        // Accept either a transformed tableData row or the raw API object. If a.lastSeen is
        // already present (from tableData), prefer it. Otherwise, fall back to raw.tid parsing.
        const raw = a._aircraft || a;

        // Helper to format a Date as HH:mm:ss
        const fmtTime = (date) => {
            if (!(date instanceof Date) || isNaN(date)) return "–";
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        };

        // Prefer already-computed/normalized fields from the tableData row
        const rawFlightCandidate = (a.flight && a.flight !== '–') ? a.flight : (raw.callsign || raw.flight || '');
        const flight = (typeof rawFlightCandidate === 'string' && rawFlightCandidate.trim()) ? rawFlightCandidate.trim() : '–';
        const airline = (a.airline && a.airline !== '–') ? a.airline : (raw.airline || '–');

        const alt = (a.altitude && a.altitude !== '–') ? `${a.altitude} ft` : (typeof raw.alt_ft === 'number' ? `${raw.alt_ft} ft` : '–');
        const spd = (a.speed && a.speed !== '–') ? `${a.speed} kn` : (typeof raw.spd_kn === 'number' ? `${raw.spd_kn.toFixed(1)} kn` : '–');
        const track = (a.track && a.track !== '–') ? a.track : (raw.track_deg != null ? `${raw.track_deg}°` : '–');
        const nm = (a.distance && a.distance !== '–') ? `${a.distance} nm` : (typeof raw.dist_nm === 'number' ? `${raw.dist_nm.toFixed(1)} nm` : '–');

        // Callsign (kjennetegn) — try several common property names
        const callsignCandidates = [raw.callsign, raw.flight, raw.registration, raw.reg, raw.icao, raw.icao24, raw.kjennetegn];
        const callsignRaw = callsignCandidates.find(v => typeof v === 'string' && v.trim());
        const callsign = callsignRaw ? callsignRaw.trim() : '–';

        // Aircraft type (flytype) — try several common property names
        const atypeCandidates = [raw.aircraft_type, raw.type, raw.model, raw.aircrafttype, raw.plane_type];
        const aircraftTypeRaw = atypeCandidates.find(v => typeof v === 'string' && v.trim());
        const aircraftType = aircraftTypeRaw ? aircraftTypeRaw.trim() : '–';

        // Vertical speed / climb (stigning) — detect units and format both fpm and m/s when possible
        let climb = '–';
        const vsCandidates = [raw.baro_rate, raw.geom_rate, raw.vs_fpm, raw.vs, raw.vsi, raw.vertical_rate, raw.vr, raw.vspeed];
        let vsVal = null;
        for (const c of vsCandidates) {
            if (typeof c === 'number' && !isNaN(c)) { vsVal = c; break; }
        }
        // If we found a numeric vertical speed, try to infer units:
        if (typeof vsVal === 'number') {
            // If value is small (abs < 50) it's likely meters/sec; treat as m/s and convert to fpm.
            if (Math.abs(vsVal) < 50) {
                const fpm = Math.round(vsVal * 196.850393701);
                const ms = (vsVal).toFixed(1);
                climb = `${fpm > 0 ? '+' : ''}${fpm} fpm (${ms} m/s)`;
            } else {
                // Otherwise assume it's already fpm
                const fpm = Math.round(vsVal);
                const ms = (fpm / 196.850393701).toFixed(1);
                climb = `${fpm > 0 ? '+' : ''}${fpm} fpm (${ms} m/s)`;
            }
        }

        // lastSeen: prefer preformatted a.lastSeen, else parse raw.tid if present
        let lastSeen = '–';
        if (typeof a.lastSeen === 'string' && a.lastSeen !== '–') {
            lastSeen = a.lastSeen;
        } else if (raw.tid) {
            let dateObj = null;
            if (typeof raw.tid === 'number') {
                dateObj = new Date(raw.tid * 1000);
            } else if (typeof raw.tid === 'string') {
                const parsed = Date.parse(raw.tid);
                if (!isNaN(parsed)) dateObj = new Date(parsed);
            }
            if (dateObj instanceof Date && !isNaN(dateObj)) lastSeen = fmtTime(dateObj);
        }

        // Use Norwegian labels for the fields the user asked for (kjennetegn, flytype, stigning)
        return `Flight: ${flight}\nFlyselskap: ${airline}\nKjennetegn: ${callsign}\nFlytype: ${aircraftType}\nHøyde: ${alt}\nFart: ${spd}\nKurs: ${track}\nStigning: ${climb}\nAvstand: ${nm}\nSist sett: ${lastSeen}`;
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
        // Convert aircraft data to table format (no HTML in data)
        const tableData = aircraft.map(a => {
            const flightNumber = a.flight || a.callsign || "–";
            const airline = a.airline || "–";

            let lastSeen = "–";
            if (a.tid) {
                let dateObj;
                if (typeof a.tid === 'number') {
                    dateObj = new Date(a.tid * 1000);
                } else if (typeof a.tid === 'string') {
                    const parsed = Date.parse(a.tid);
                    if (!isNaN(parsed)) dateObj = new Date(parsed);
                }
                if (dateObj instanceof Date && !isNaN(dateObj)) {
                    const pad = n => String(n).padStart(2, "0");
                    lastSeen = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
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
                lastSeen,
                _aircraft: a
            };
        });

        // Add an explicit header for the actions column
        const headers = ['Flight', 'Flyselskap', 'Høyde (ft)', 'Fart (kt)', 'Retning', 'Avstand (nm)', 'Sist sett', ''];

        // Build a detached table with text-only cells (no HTML strings)
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
                '' // placeholder for the action icon
            ]),
            onRowClick: (rowData, index) => {
                const item = tableData[index];
                if (item.flight === "–") return;

                const url = safeUrlFrom(this.flightAwareUrl(item.flight), {
                    allowedHosts: ['www.flightaware.com', 'flightaware.com']
                });
                if (url) {
                    const w = window.open(url, "_blank", "noopener,noreferrer");
                    if (w) w.opener = null;
                }
            }
        });

        // Replace visible table body without using innerHTML
        const tbody = this.elements.tbody();
        const realTable = tbody ? tbody.closest('table') : null;
        const tmpTbody = tableEl.querySelector('tbody');
        if (!tbody || !realTable || !tmpTbody) return;

        // Clear existing rows
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

        // Helper to build the plane icon safely (trusted constant)
        const makePlaneIcon = () => {
            const tmpl = document.createElement('template');
            tmpl.innerHTML = this.iconPlane.trim(); // keep as constant; if ever user-provided, sanitize or DOM-build
            return tmpl.content.firstElementChild ? tmpl.content.firstElementChild.cloneNode(true) : null;
        };

        // Move rows over and populate the actions cell via DOM APIs
        Array.from(tmpTbody.querySelectorAll('tr')).forEach((tr, idx) => {
            // Attach reference for tooltip logic — use the transformed tableData entry so tooltips
            // receive normalized fields like `flight`, `airline` and formatted `lastSeen`.
            tr._aircraft = tableData[idx];

            // Actions cell is the last td
            const actionsTd = tr.lastElementChild;

            const flightVal = tableData[idx]?.flight;
            if (flightVal && flightVal !== "–") {
                const url = safeUrlFrom(this.flightAwareUrl(flightVal), {
                    allowedHosts: ['www.flightaware.com', 'flightaware.com']
                });

                if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.className = 'iconbtn';
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.title = "Åpne i FlightAware";

                    const svg = makePlaneIcon();
                    if (svg) a.appendChild(svg);

                    a.addEventListener('click', (ev) => ev.stopPropagation());
                    actionsTd.appendChild(a);
                } else {
                    // No safe URL — leave empty and make row non-clickable feeling if desired
                    actionsTd.textContent = '';
                }
            } else {
                actionsTd.textContent = '';
            }

            tbody.appendChild(tr);
        });

        // Attach handlers to the *real* DOM table
        this.addTooltipHandlers(realTable, tableData);
    }

    addTooltipHandlers(tableEl, aircraftData) {
        if (!tableEl || tableEl.dataset.tooltipInitialized === "1") return;
        tableEl.dataset.tooltipInitialized = "1";

        const tooltip = ensureTooltip();
        const rows = tableEl.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
            // Prefer the aircraft stored on the element (robust if rows were moved/reordered)
            const aircraft = row._aircraft || aircraftData?.[index]?._aircraft;
            if (!aircraft) return;

            // Show: set content, position first (which may temporarily show for measurement),
            // then ensure it's visible so it doesn't get hidden by positionTooltip internals.
            const show = (e) => {
                tooltip.textContent = this.makeTooltipText(aircraft);
                positionTooltip(e, tooltip);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
            };
            const move = (e) => positionTooltip(e, tooltip);
            const hide = () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            };

            row.addEventListener("mouseenter", show);
            row.addEventListener("mousemove", move);
            row.addEventListener("mouseleave", hide);

            const icon = row.querySelector('.iconbtn');
            if (icon) {
                icon.addEventListener("mouseenter", (e) => { e.stopPropagation(); show(e); });
                icon.addEventListener("mousemove", (e) => { e.stopPropagation(); move(e); });
                icon.addEventListener("mouseleave", (e) => { e.stopPropagation(); hide(); });
            }
        });

        tableEl.addEventListener("mouseleave", () => { tooltip.hidden = true; });
        window.addEventListener("scroll", () => { tooltip.hidden = true; }, {passive: true});
    }


    async loadAdsb() {
        try {
            UIComponents.toggleElement(this.elements.error(), false);

            const data = await apiClient.get(this.endpoint, 'adsb');

            // Handle both null responses and proper data structure
            let aircraft;
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