(function () {
    const ORIGIN = {lat: 64.3278592, lon: 10.4155161}; // Ramsøyvika
    const MAX_DIST_KM = 100;   // radius
    const MAX_SEEN_S = 60;    // nylig sett

    const $tbody = () => document.querySelector('#adsb-table tbody');
    const $wrap = () => document.getElementById('adsb-table-wrap');
    const $empty = () => document.getElementById('adsb-empty');
    const $error = () => document.getElementById('adsb-error');
    const $count = () => document.getElementById('adsb-count');
    const $updated = () => document.getElementById('adsb-updated');
    const $tooltip = () => window.__ensureTooltip();


    function fmt(val, suffix = '') {
        return (val == null || Number.isNaN(Number(val))) ? '–' : `${val}${suffix}`;
    }

    function fmtFt(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} ft`;
    }

    function fmtFpm(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} ft/min`;
    }

    function fmtKt(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(val)} kt`;
    }

    function fmtDeg(val) {
        return (val == null || isNaN(val)) ? '–' : `${Math.round(((val % 360) + 360) % 360)}°`;
    }

    function makeAdsbTooltip(a) {
        const lines = [];
        const flight = (a.flight || '').trim() || a.hex || '–';
        const reg = a.r || a.reg || '–';
        const type = a.t || a.type || '–';
        const squawk = a.squawk || '–';
        const alt = fmtFt(a.alt_baro);
        const vr = fmtFpm(a.baro_rate ?? a.vert_rate);
        const gs = fmtKt(a.gs);
        const trk = fmtDeg(a.track);
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

    const fmtGs = kt => kt == null ? '—' : Math.round(kt) + ' kt';
    const fmtNm = nm => nm < 1 ? (nm * 1000 / 1.852 | 0) + ' m' : nm.toFixed(1) + ' nm';
    const fmtSeen = s => s == null ? '—' : s.toFixed(1) + ' s';
    // Ikoner (inline SVG)
    const ICON_SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/></svg>`;

    function fmtAlt(ft) {
        if (ft == null) return '—';
        if (typeof ft === 'string') return ft;
        return Math.round(ft).toLocaleString('no-NO') + ' ft';
    }

    function fr24FlightUrl(flight) {
        return 'https://www.flightradar24.com/64.32,10.41/8';
    }

    function googleFlightUrl(flight) {
        return `https://www.google.com/search?q=${encodeURIComponent(flight + ' flight')}`;
    }

    // Fetch aircraft data from server-side proxy
    async function fetchAircraft() {
        const url = `/api/adsb_proxy.php?lat=${ORIGIN.lat}&lon=${ORIGIN.lon}&radius=${MAX_DIST_KM}&max_age=${MAX_SEEN_S}`;
        const res = await fetch(url, {cache: 'no-store'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Server error');
        return data;
    }

    function makeHeadingCell(track) {
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

    function render(rows) {
        const tb = $tbody();
        tb.innerHTML = '';
        rows.forEach(a => {
            const tr = document.createElement('tr');
            tr.addEventListener('mouseenter', e => {
                const t = $tooltip();
                t.textContent = makeAdsbTooltip(a);
                t.style.display = 'block';
                t.style.visibility = 'visible';
                window.__positionTooltip(e, t);
            });
            tr.addEventListener('mousemove', e => {
                const t = $tooltip();
                window.__positionTooltip(e, t);
            });
            tr.addEventListener('mouseleave', () => {
                const t = $tooltip();
                t.style.visibility = '';
                t.style.display = 'none';
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
            tdAlt.textContent = fmtAlt(a.alt_baro);
            tr.appendChild(tdAlt);
            const tdSpd = document.createElement('td');
            tdSpd.textContent = fmtGs(a.gs);
            tr.appendChild(tdSpd);
            tr.appendChild(makeHeadingCell(a.track));
            const tdDist = document.createElement('td');
            tdDist.textContent = a.distance_nm != null ? fmtNm(a.distance_nm) : '—';
            tr.appendChild(tdDist);
            const tdSeen = document.createElement('td');
            tdSeen.textContent = fmtSeen(a.seen);
            tr.appendChild(tdSeen);
            const tdAct = document.createElement('td');
            tdAct.className = 'row-actions';
            const btn = document.createElement('a');
            btn.className = 'iconbtn';
            btn.href = fr24FlightUrl(flight);
            btn.target = '_blank';
            btn.rel = 'noopener';
            btn.title = 'Åpne i Flightradar24';
            btn.innerHTML = ICON_SEARCH;
            btn.addEventListener('click', ev => ev.stopPropagation());
            tdAct.appendChild(btn);
            tr.appendChild(tdAct);

            // Ctrl/Meta-klikk på raden åpner Google-søk for flighten i ny fane
            tr.addEventListener('click', (ev) => {
                if (ev.ctrlKey || ev.metaKey) {
                    const url = googleFlightUrl(flight);
                    window.open(url, '_blank', 'noopener');
                }
            });
            tb.appendChild(tr);
        });
    }

    function fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }


    async function tick() {
        try {
            $error().hidden = true;
            const data = await fetchAircraft();
            const list = data.aircraft || [];

            const hasRows = list.length > 0;
            $wrap().hidden = !hasRows;
            $empty().hidden = hasRows;
            render(list);
            $count().textContent = list.length;
            $updated().textContent = `oppdatert ${fmtUpdated()}`;
        } catch (err) {
            console.error('ADS-B feil:', err);
            $error().hidden = false;
            $updated().textContent = 'feil ved oppdatering';
        }
    }

    tick();
    setInterval(tick, 20000); // Update every 20 seconds
})();
