(function () {
    const LAT = 64.3278592, LON = 10.4155161;

    function isoLocal(d) {
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

    function norskType(t) {
        if (!t) return "";
        const key = String(t).toLowerCase();
        if (key === 'high' || key === 'flo' || key === 'highwater') return 'Flo';
        if (key === 'low' || key === 'fjære' || key === 'lowwater') return 'Fjære';
        return key;
    }

    const fmtTid = d => d.toLocaleTimeString('no-NO', {hour: '2-digit', minute: '2-digit'});
    const fmtM = cm => (cm / 100).toFixed(2) + ' m';

    async function hentToNeste() {
        const now = new Date();
        const to = new Date(now.getTime() + 72 * 60 * 60 * 1000);
        const url = new URL('https://vannstand.kartverket.no/tideapi.php');
        url.search = new URLSearchParams({
            tide_request: 'locationdata',
            lat: String(LAT),
            lon: String(LON),
            datatype: 'tab',
            refcode: 'cd',
            lang: 'nb',
            fromtime: isoLocal(now),
            totime: isoLocal(to),
            tzone: '1',
            dst: '1'
        }).toString();
        const res = await fetch(url, {cache: 'no-store'});
        const xml = await res.text();
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const items = Array.from(doc.querySelectorAll('waterlevel')).slice(0, 2).map(el => ({
            type: el.getAttribute('type') ?? el.getAttribute('flag') ?? el.getAttribute('kind') ?? el.getAttribute('tide'),
            time: new Date(el.getAttribute('time')),
            cm: Number(el.getAttribute('value'))
        }));
        const [a, b] = items;
        const el1 = document.getElementById('tideNext1');
        const el2 = document.getElementById('tideNext2');
        if (a) el1.textContent = `${norskType(a.type)}${a.type ? " " : ""}${fmtTid(a.time)} (${fmtM(a.cm)})`; else el1.textContent = '—';
        if (b) el2.textContent = `${norskType(b.type)}${b.type ? " " : ""}${fmtTid(b.time)} (${fmtM(b.cm)})`; else el2.textContent = '—';
    }

    hentToNeste();
    setInterval(hentToNeste, 30 * 60 * 1000);
})();