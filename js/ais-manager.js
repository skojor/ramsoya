(function () {
    const ENDPOINT = "data/getaislist.php";
    const REFRESH_MS = 20_000;
    const $tbody = () => document.querySelector("#ais-table tbody");
    const $count = () => document.getElementById("ais-count");
    const $updated = () => document.getElementById("ais-updated");
    const $empty = () => document.getElementById("ais-empty");
    const $error = () => document.getElementById("ais-error");
    const $wrap = () => document.getElementById("ais-table-wrap");
    const $tooltip = () => window.__ensureTooltip();

    function fmtUpdated(date = new Date()) {
        const pad = n => String(n).padStart(2, "0");
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function makeTooltipText(v) {
        const dpg = (v.draught_dm != null) ? (Number(v.draught_dm) / 10).toFixed(1) + " m" : "–";
        const spd = (typeof v.spd_kn === "number") ? v.spd_kn.toFixed(1) + " kn" : "–";
        const cog = (v.cog_deg != null) ? v.cog_deg + "°" : "–";
        const hdg = (v.hdg_deg != null) ? v.hdg_deg + "°" : "–";
        const nm = (typeof v.dist_nm === "number") ? v.dist_nm.toFixed(1) + " nm" : "–";
        return `Navn: ${v.name?.trim() || "–"}\nMMSI: ${v.mmsi || "–"}\nKallesignal: ${v.callsign || "–"}\nDestinasjon: ${v.dest || "–"}\nETA: ${v.eta || "–"}\nDypgang: ${dpg}\nKurs: ${cog} / Heading: ${hdg}\nFart: ${spd}\nAvstand: ${nm}\nSist oppdatert: ${v.tid || "–"}`;
    }

// Ikon og lenkebygger for MarineTraffic
    const ICON_SHIP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.59 13.41L12 10 3.41 13.41 2 12l10-4 10 4-1.41 1.41zM4 16c1.1 0 2 .9 2 2h12a2 2 0 114 0h-2a2 2 0 10-4 0H8a2 2 0 10-4 0H2a2 2 0 110-4h2z"/></svg>`;

    function marineTrafficUrl(mmsi) {
        if (!mmsi) return null;
        return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`;
    }

    function renderRows(vessels) {
        const tb = $tbody();
        const tooltip = $tooltip();
        tb.innerHTML = "";
        vessels.forEach(v => {
            const tr = document.createElement("tr");
            tr.addEventListener("click", () => {
                window.open("https://ramsoy.iship.no", "_blank", "noopener");
            });
            tr.addEventListener("mouseenter", e => {
                tooltip.textContent = makeTooltipText(v);
                tooltip.style.display = 'block';
                tooltip.style.visibility = 'visible';
                window.__positionTooltip(e, tooltip);
            });
            tr.addEventListener("mousemove", e => {
                window.__positionTooltip(e, tooltip);
            });
            tr.addEventListener("mouseleave", () => {
                tooltip.style.visibility = '';
                tooltip.style.display = 'none';
            });
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
                a.href = marineTrafficUrl(v.mmsi);
                a.target = '_blank';
                a.rel = 'noopener';
                a.title = 'Åpne i MarineTraffic';
                a.innerHTML = ICON_SHIP;
                a.addEventListener('click', ev => ev.stopPropagation());
                tdAct.appendChild(a);
            }
            tr.appendChild(tdAct);
            tb.appendChild(tr);
        });
        document.getElementById("ais-table").addEventListener("mouseleave", () => {
            $tooltip().hidden = true;
        }, {once: true});
        window.addEventListener("scroll", () => {
            $tooltip().hidden = true;
        }, {passive: true});
    }

    async function loadAis() {
        try {
            $error().hidden = true;
            const res = await fetch(ENDPOINT, {cache: "no-store"});
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const vessels = Array.isArray(data?.vessels) ? data.vessels : [];
            const hasRows = vessels.length > 0;
            $wrap().hidden = !hasRows;
            $empty().hidden = hasRows;
            renderRows(vessels);
            $count().textContent = vessels.length;
            $updated().textContent = `oppdatert ${fmtUpdated()}`;
        } catch (err) {
            console.error("AIS feil:", err);
            $error().hidden = false;
            $updated().textContent = "feil ved oppdatering";
        }
    }

    loadAis();
    setInterval(loadAis, REFRESH_MS);
})();