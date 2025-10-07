// AIS vessel tracking management
import { CONFIG } from './constants.js';
import { ensureTooltip, positionTooltip } from './tooltip-helpers.js';

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

        this.init();
    }

    init() {
        this.loadAis();
        setInterval(() => this.loadAis(), this.refreshMs);
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

    renderRows(vessels) {
        const tbody = this.elements.tbody();
        const tooltip = ensureTooltip();
        tbody.innerHTML = "";

        vessels.forEach(v => {
            const tr = document.createElement("tr");

            // Event listeners
            tr.addEventListener("click", () => {
                window.open(CONFIG.EXTERNAL.RAMSOY_ISHIP, "_blank", "noopener");
            });

            tr.addEventListener("mouseenter", e => {
                tooltip.textContent = this.makeTooltipText(v);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
                positionTooltip(e, tooltip);
            });

            tr.addEventListener("mousemove", e => {
                positionTooltip(e, tooltip);
            });

            tr.addEventListener("mouseleave", () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            });

            // Build table cells
            const tdName = document.createElement("td");
            tdName.textContent = (v.name && String(v.name).trim()) || "–";
            tr.appendChild(tdName);

            const tdSpd = document.createElement("td");
            tdSpd.textContent = (typeof v.spd_kn === "number") ? v.spd_kn.toFixed(1) : "–";
            tr.appendChild(tdSpd);

            const tdCog = document.createElement("td");
            const rawCog = (v.cog ?? v.cog_deg);
            const numCog = Number(rawCog);
            if (Number.isFinite(numCog)) {
                let cog = ((numCog % 360) + 360) % 360;
                cog = Math.round(cog);
                const rot = ((cog - 90) % 360 + 360) % 360;
                tdCog.innerHTML = `<span class="cog-wrap"><svg class="cog-arrow" viewBox="0 0 48 48" aria-label="Kurs ${cog}°"><g class="outline"><line x1="8" y1="24" x2="32" y2="24"></line></g><line class="shaft" x1="8" y1="24" x2="32" y2="24"></line><polygon class="head" points="32,16 44,24 32,32 34,24"></polygon></svg><span class="cog-text">${cog}°</span></span>`;
                tdCog.querySelector('.cog-arrow').style.transform = `rotate(${rot}deg)`;
            } else {
                tdCog.textContent = "–";
            }
            tr.appendChild(tdCog);

            const tdCall = document.createElement("td");
            tdCall.textContent = (v.callsign && String(v.callsign).trim()) || "–";
            tr.appendChild(tdCall);

            const tdDest = document.createElement("td");
            tdDest.textContent = (v.dest && String(v.dest).trim()) || "–";
            tr.appendChild(tdDest);

            const tdDist = document.createElement("td");
            tdDist.textContent = (typeof v.dist_nm === "number") ? v.dist_nm.toFixed(1) : "–";
            tr.appendChild(tdDist);

            const tdAct = document.createElement('td');
            tdAct.className = 'row-actions';
            if (v.mmsi) {
                const a = document.createElement('a');
                a.className = 'iconbtn';
                a.href = this.marineTrafficUrl(v.mmsi);
                a.target = '_blank';
                a.rel = 'noopener';
                a.title = 'Åpne i MarineTraffic';
                a.innerHTML = this.iconShip;
                a.addEventListener('click', ev => ev.stopPropagation());
                tdAct.appendChild(a);
            }
            tr.appendChild(tdAct);
            tbody.appendChild(tr);
        });

        this.elements.table().addEventListener("mouseleave", () => {
            tooltip.hidden = true;
        }, {once: true});

        window.addEventListener("scroll", () => {
            tooltip.hidden = true;
        }, {passive: true});
    }

    async loadAis() {
        try {
            this.elements.error().hidden = true;
            const res = await fetch(this.endpoint, {cache: "no-store"});
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const vessels = Array.isArray(data?.vessels) ? data.vessels : [];
            const hasRows = vessels.length > 0;

            this.elements.wrap().hidden = !hasRows;
            this.elements.empty().hidden = hasRows;
            this.renderRows(vessels);
            this.elements.count().textContent = vessels.length;
            this.elements.updated().textContent = `oppdatert ${this.fmtUpdated()}`;
        } catch (err) {
            console.error("AIS feil:", err);
            this.elements.error().hidden = false;
            this.elements.updated().textContent = "feil ved oppdatering";
        }
    }
}
