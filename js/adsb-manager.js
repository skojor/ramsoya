// ADS-B aircraft tracking management
import { CONFIG } from './constants.js';
import { ensureTooltip, positionTooltip } from './tooltip-helpers.js';

export class ADSBManager {
    constructor() {
        this.origin = {lat: CONFIG.LOCATION.LAT, lon: CONFIG.LOCATION.LON};
        this.maxDistKm = CONFIG.ADSB.MAX_DIST_KM;
        this.maxSeenS = CONFIG.ADSB.MAX_SEEN_S;
        this.refreshMs = CONFIG.INTERVALS.ADSB_REFRESH;

        this.iconSearch = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/></svg>`;

        // DOM element getters
        this.elements = {
            tbody: () => document.querySelector('#adsb-table tbody'),
            wrap: () => document.getElementById('adsb-table-wrap'),
            empty: () => document.getElementById('adsb-empty'),
            error: () => document.getElementById('adsb-error'),
            count: () => document.getElementById('adsb-count'),
            updated: () => document.getElementById('adsb-updated')
        };

        this.init();
    }

    init() {
        this.tick();
        setInterval(() => this.tick(), this.refreshMs);
    }

    fmt(val, suffix = '') {
        return (val == null || Number.isNaN(Number(val))) ? '–' : `${val}${suffix}`;
    }

    fmtFt(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} ft`;
    }

    fmtFpm(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} ft/min`;
    }

    fmtKt(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} kt`;
    }

    fmtDeg(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(((val % 360) + 360) % 360)}°`;
    }

    fmtGs(kt) {
        return kt == null ? '—' : Math.round(kt) + ' kt';
    }

    fmtNm(nm) {
        return nm < 1 ? (nm * 1000 / 1.852 | 0) + ' m' : nm.toFixed(1) + ' nm';
    }

    fmtSeen(s) {
        return s == null ? '—' : s.toFixed(1) + ' s';
    }

    fmtAlt(ft) {
        if (ft == null) return '—';
        if (typeof ft === 'string') return ft;
        return Math.round(ft).toLocaleString('no-NO') + ' ft';
    }

    fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    makeAdsbTooltip(a) {
        const lines = [];
        const flight = (a.flight || '').trim() || a.hex || '–';
        const reg = a.r || a.reg || '–';
        const type = a.t || a.type || '–';
        const squawk = a.squawk || '–';
        const alt = this.fmtFt(a.alt_baro);
        const vr = this.fmtFpm(a.baro_rate ?? a.vert_rate);
        const gs = this.fmtKt(a.gs);
        const trk = this.fmtDeg(a.track);
        const dist = (a.distance_nm != null) ? (a.distance_nm < 1 ? `${(a.distance_nm * 1000 / 1.852 | 0)} m` : `${a.distance_nm.toFixed(1)} nm`) : '–';
        const seen = (a.seen != null) ? `${a.seen.toFixed(1)} s` : '–';
        const airline = a.airline || '–';

        lines.push(`Flight: ${flight}`);
        lines.push(`Flyselskap: ${airline}`);
        lines.push(`ICAO: ${a.hex || '–'}`);
        lines.push(`Reg: ${reg}`);
        lines.push(`Type: ${type}`);
        lines.push(`Squawk: ${squawk}`);
        lines.push(`Høyde: ${alt}`);
        lines.push(`Stige/synk: ${vr}`);
        lines.push(`Fart: ${gs}`);
        lines.push(`Retning: ${trk}`);
        lines.push(`Avstand: ${dist}`);
        lines.push(`Sist sett: ${seen}`);
        lines.push('\nSøk: åpne i Google (Ctrl/⌘-klikk)');
        return lines.join('\n');
    }

    fr24FlightUrl(flight) {
        return CONFIG.EXTERNAL.FLIGHTRADAR24;
    }

    googleFlightUrl(flight) {
        return `${CONFIG.EXTERNAL.GOOGLE_FLIGHT_SEARCH}${encodeURIComponent(flight + ' flight')}`;
    }

    async fetchAircraft() {
        const url = `${CONFIG.ENDPOINTS.ADSB}?lat=${this.origin.lat}&lon=${this.origin.lon}&radius=${this.maxDistKm}&max_age=${this.maxSeenS}`;
        const res = await fetch(url, {cache: 'no-store'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Server error');
        return data;
    }

    makeHeadingCell(track) {
        const td = document.createElement('td');
        const n = Number(track);
        if (Number.isFinite(n)) {
            let hdg = ((n % 360) + 360) % 360;
            hdg = Math.round(hdg);
            const rot = ((hdg - 90) % 360 + 360) % 360;
            td.innerHTML = `<span class="cog-wrap"><svg class="cog-arrow" viewBox="0 0 48 48" aria-label="Retning ${hdg}°"><g class="outline"><line x1="8" y1="24" x2="32" y2="24"></line></g><line class="shaft" x1="8" y1="24" x2="32" y2="24"></line><polygon class="head" points="32,16 44,24 32,32 34,24"></polygon></svg><span class="cog-text">${hdg}°</span></span>`;
            td.querySelector('.cog-arrow').style.transform = `rotate(${rot}deg)`;
        } else {
            td.textContent = '—';
        }
        return td;
    }

    render(rows) {
        const tbody = this.elements.tbody();
        const tooltip = ensureTooltip();
        tbody.innerHTML = '';

        rows.forEach(a => {
            const tr = document.createElement('tr');

            tr.addEventListener('mouseenter', e => {
                tooltip.textContent = this.makeAdsbTooltip(a);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
                positionTooltip(e, tooltip);
            });

            tr.addEventListener('mousemove', e => {
                positionTooltip(e, tooltip);
            });

            tr.addEventListener('mouseleave', () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            });

            const flight = (a.flight || '').trim() || (a.t || a.hex || '—');

            const tdF = document.createElement('td');
            tdF.textContent = flight;
            tr.appendChild(tdF);

            const airline = a.airline || '—';
            const tdAir = document.createElement('td');
            tdAir.textContent = airline;
            tr.appendChild(tdAir);

            const tdAlt = document.createElement('td');
            tdAlt.textContent = this.fmtAlt(a.alt_baro);
            tr.appendChild(tdAlt);

            const tdSpd = document.createElement('td');
            tdSpd.textContent = this.fmtGs(a.gs);
            tr.appendChild(tdSpd);

            tr.appendChild(this.makeHeadingCell(a.track));

            const tdDist = document.createElement('td');
            tdDist.textContent = a.distance_nm != null ? this.fmtNm(a.distance_nm) : '—';
            tr.appendChild(tdDist);

            const tdSeen = document.createElement('td');
            tdSeen.textContent = this.fmtSeen(a.seen);
            tr.appendChild(tdSeen);

            const tdAct = document.createElement('td');
            tdAct.className = 'row-actions';
            const btn = document.createElement('a');
            btn.className = 'iconbtn';
            btn.href = this.fr24FlightUrl(flight);
            btn.target = '_blank';
            btn.rel = 'noopener';
            btn.title = 'Åpne i Flightradar24';
            btn.innerHTML = this.iconSearch;
            btn.addEventListener('click', ev => ev.stopPropagation());
            tdAct.appendChild(btn);
            tr.appendChild(tdAct);

            // Ctrl/Meta-klikk på raden åpner Google-søk for flighten i ny fane
            tr.addEventListener('click', (ev) => {
                if (ev.ctrlKey || ev.metaKey) {
                    const url = this.googleFlightUrl(flight);
                    window.open(url, '_blank', 'noopener');
                }
            });
            tbody.appendChild(tr);
        });
    }

    async tick() {
        try {
            this.elements.error().hidden = true;
            const data = await this.fetchAircraft();
            const list = data.aircraft || [];

            const hasRows = list.length > 0;
            this.elements.wrap().hidden = !hasRows;
            this.elements.empty().hidden = hasRows;
            this.render(list);
            this.elements.count().textContent = list.length;
            this.elements.updated().textContent = `oppdatert ${this.fmtUpdated()}`;
        } catch (err) {
            console.error('ADS-B feil:', err);
            this.elements.error().hidden = false;
            this.elements.updated().textContent = 'feil ved oppdatering';
        }
    }
}
