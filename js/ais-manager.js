// AIS vessel tracking management
import { CONFIG } from './constants.js';
import { ensureTooltip, positionTooltip, safeUrlFrom } from './utils.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';
import { visibilityManager } from './visibility-manager.js';

export class AISManager {
    constructor() {
        this.endpoint = CONFIG.ENDPOINTS.AIS;
        this.refreshMs = CONFIG.INTERVALS.AIS_REFRESH;
        this.iconShip = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.59 13.41L12 10 3.41 13.41 2 12l10-4 10 4-1.41 1.41zM4 16c1.1 0 2 .9 2 2h12a2 2 0 114 0h-2a2 2 0 10-4 0H8a2 2 0 10-4 0H2a2 2 0 110-4h2z"/></svg>`;

        // DOM element getters
        this.elements = {
            tbody: () => document.querySelector("#ais-table tbody"),
            count: () => document.getElementById("ais-count"),
            updated: () => document.getElementById("ais-updated"),
            empty: () => document.getElementById("ais-empty"),
            error: () => document.getElementById("ais-error"),
            wrap: () => document.getElementById("ais-table-wrap"),
            table: () => document.getElementById("ais-table")
        };

        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Re-render when AIS data changes
        appState.subscribe('location.ais', (vessels) => {
            this.renderVessels(vessels);
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.ais !== undefined) {
                this.updateLoadingState(loadingStates.ais);
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
        this.loadAis();

        // Setup visibility-aware interval for real-time vessel tracking
        visibilityManager.setInterval('ais',
            () => this.loadAis(),
            this.refreshMs,
            4 // 4x slower when hidden (20s -> 80s) - vessels move slowly
        );
    }

    fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, "0");
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    makeTooltipText(v) {
        const dpg = (v.draught_dm != null) ? (Number(v.draught_dm) / 10).toFixed(1) + " m" : "–";
        const spd = (typeof v.spd_kn === "number") ? v.spd_kn.toFixed(1) + " kn" : "–";
        const cog = (v.cog_deg != null) ? v.cog_deg + "°" : "–";
        const hdg = (v.hdg_deg != null) ? v.hdg_deg + "°" : "–";
        const nm = (typeof v.dist_nm === "number") ? v.dist_nm.toFixed(1) + " nm" : "–";
        return `Navn: ${v.name?.trim() || "–"}\nMMSI: ${v.mmsi || "–"}\nKallesignal: ${v.callsign || "–"}\nDestinasjon: ${v.dest || "–"}\nETA: ${v.eta || "–"}\nDypgang: ${dpg}\nKurs: ${cog} / Heading: ${hdg}\nFart: ${spd}\nAvstand: ${nm}\nSist oppdatert: ${v.tid || "–"}`;
    }

    marineTrafficUrl(mmsi) {
        if (!mmsi) return null;
        return `${CONFIG.EXTERNAL.MARINE_TRAFFIC}${mmsi}`;
    }

    renderVessels(vessels) {
        const hasRows = vessels.length > 0;
        UIComponents.toggleElement(this.elements.wrap(), hasRows);
        UIComponents.toggleElement(this.elements.empty(), !hasRows);

        // Update count with multiple fallback methods
        const count = vessels.length;
        // Method 1: Try UIComponents
        const countElement = this.elements.count();
        if (countElement) {
            UIComponents.updateContent(countElement, count);
        } else {
            console.error('AIS Count element not found via this.elements.count()!');
        }

        // Method 2: Direct DOM fallback to ensure it works
        const directCountElement = document.getElementById('ais-count');
        if (directCountElement) {
            directCountElement.textContent = count.toString();
        } else {
            console.error('AIS Count element not found via direct DOM query!');
        }

        UIComponents.updateContent(this.elements.updated(), `oppdatert ${this.fmtUpdated()}`);

        if (hasRows) {
            this.renderTable(vessels);
        }
    }

    renderTable(vessels) {
        // Convert vessel data to table format
        const tableData = vessels.map(v => {
            const rawCog = (v.cog ?? v.cog_deg);
            const numCog = Number(rawCog);
            let cogDisplay = "–";

            if (Number.isFinite(numCog)) {
                let cog = ((numCog % 360) + 360) % 360;
                cog = Math.round(cog);
                const rot = ((cog - 90) % 360 + 360) % 360;
                cogDisplay = `<span class="cog-wrap"><svg class="cog-arrow" viewBox="0 0 48 48" aria-label="Kurs ${cog}°" style="transform: rotate(${rot}deg);"><g class="outline"><line x1="8" y1="24" x2="32" y2="24"></line></g><line class="shaft" x1="8" y1="24" x2="32" y2="24"></line><polygon class="head" points="32,16 44,24 32,32 34,24"></polygon></svg><span class="cog-text">${cog}°</span></span>`;
            }

            const actions = v.mmsi ? `<a class="iconbtn" href="${this.marineTrafficUrl(v.mmsi)}" target="_blank" rel="noopener" title="Åpne i MarineTraffic" onclick="event.stopPropagation()">${this.iconShip}</a>` : '';

            return {
                name: (v.name && String(v.name).trim()) || "–",
                speed: (typeof v.spd_kn === "number") ? v.spd_kn.toFixed(1) : "–",
                course: cogDisplay,
                callsign: (v.callsign && String(v.callsign).trim()) || "–",
                destination: (v.dest && String(v.dest).trim()) || "–",
                distance: (typeof v.dist_nm === "number") ? v.dist_nm.toFixed(1) : "–",
                actions: actions,
                _vessel: v // Keep reference for tooltip and click handling
            };
        });

        const headers = ['Navn', 'Fart', 'Kurs', 'Kallesignal', 'Destinasjon', 'Avstand', ''];

        // Create table using UIComponents
        const tableEl = UIComponents.createTable({
            headers,
            rows: tableData.map(row => [
                row.name,
                row.speed,
                row.course,
                row.callsign,
                row.destination,
                row.distance,
                row.actions
            ]),
            onRowClick: (index) => {
                window.open(CONFIG.EXTERNAL.RAMSOY_ISHIP, "_blank", "noopener");
            }
        });

        // Replace table content
        const tbody = this.elements.tbody();
        const table = tbody.closest('table');
        if (table && tableEl.querySelector('table')) {
            table.querySelector('tbody').innerHTML = tableEl.querySelector('tbody').innerHTML;
            // Attach handlers to the real DOM table after we've replaced the rows
            this.addTooltipHandlers(table, tableData);
        }
    }

    addTooltipHandlers(tableEl, vessels) {
        // Determine the real visible table element. If tableEl is detached (created by UIComponents.createTable),
        // use the actual table in the DOM returned by this.elements.table(). This ensures event listeners are
        // attached to the nodes the user interacts with.
        const realTable = (tableEl instanceof Element && document.contains(tableEl)) ? tableEl : this.elements.table();
        if (!realTable) return;

        // Avoid attaching handlers multiple times
        if (realTable.dataset.tooltipInitialized === "1") return;
        realTable.dataset.tooltipInitialized = "1";

        const tooltip = ensureTooltip();
        const rows = realTable.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
            // Prefer a vessel reference attached to the row (if available) to avoid index mismatches.
            const vessel = row._vessel || vessels?.[index]?._vessel;
            if (!vessel) return;

            const show = (e) => {
                tooltip.textContent = this.makeTooltipText(vessel);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
                positionTooltip(e, tooltip);
            };
            const move = (e) => positionTooltip(e, tooltip);
            const hide = () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            };

            row.addEventListener("mouseenter", show);
            row.addEventListener("mousemove", move);
            row.addEventListener("mouseleave", hide);

            // Icon-specific behavior: sanitize the action link and ensure it doesn't propagate row clicks
            const icon = row.querySelector('.iconbtn');
            if (icon) {
                // If the anchor has an href, make sure it's safe. If not safe, remove it.
                if (icon.href) {
                    const safe = safeUrlFrom(icon.href, { allowedHosts: ['www.marinetraffic.com', 'marinetraffic.com'] });
                    if (safe) icon.href = safe; else icon.removeAttribute('href');
                }

                icon.addEventListener("mouseenter", (e) => { e.stopPropagation(); show(e); });
                icon.addEventListener("mousemove", (e) => { e.stopPropagation(); move(e); });
                icon.addEventListener("mouseleave", (e) => { e.stopPropagation(); hide(); });
                icon.addEventListener('click', (ev) => { ev.stopPropagation(); });
            }
        });

        // Hide tooltip when leaving the visible table area or on scroll
        realTable.addEventListener("mouseleave", () => { tooltip.hidden = true; });
        window.addEventListener("scroll", () => { tooltip.hidden = true; }, {passive: true});
    }

    async loadAis() {
        try {
            UIComponents.toggleElement(this.elements.error(), false);

            const data = await apiClient.get(this.endpoint, 'ais');

            // Handle both null responses and proper data structure
            let vessels;
            if (data === null) {
                console.warn('AIS API returned empty response');
                vessels = [];
            } else if (Array.isArray(data?.vessels)) {
                vessels = data.vessels;
            } else if (Array.isArray(data)) {
                // Handle case where API returns array directly
                vessels = data;
            } else {
                console.warn('Unexpected AIS data structure:', data);
                vessels = [];
            }

            // Update state instead of calling render directly
            appState.setState('location.ais', vessels);

        } catch (error) {
            console.error("AIS fetch error:", error);
            appState.setState('location.ais', []);
            UIComponents.toggleElement(this.elements.error(), true);
            UIComponents.updateContent(this.elements.updated(), "feil ved oppdatering");
        }
    }
}
