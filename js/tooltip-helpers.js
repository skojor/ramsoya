// Global, robust tooltip creator used by both AIS and ADS-B
(function () {
    function ensureTooltip() {
        let t = document.getElementById('tooltip-global');
        if (!t) {
            t = document.createElement('div');
            t.id = 'tooltip-global';
            t.setAttribute('role', 'status');
            t.style.position = 'fixed';
            t.style.left = '0px';
            t.style.top = '0px';
            t.style.padding = '8px 10px';
            t.style.background = 'rgba(8,12,18,.96)';
            t.style.color = '#e6edf3';
            t.style.border = '1px solid #2a3340';
            t.style.borderRadius = '8px';
            t.style.boxShadow = '0 10px 30px rgba(0,0,0,.45)';
            t.style.fontSize = '.9rem';
            t.style.lineHeight = '1.35';
            t.style.whiteSpace = 'pre-line';
            t.style.pointerEvents = 'none';
            t.style.maxWidth = '360px';
            t.style.zIndex = '2147483647'; // over alt
            t.style.display = 'none';
            document.body.appendChild(t);
        }
        return t;
    }

    window.__ensureTooltip = ensureTooltip;
    window.__positionTooltip = function (e, t) {
        const OFFSET = 16;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = e.clientX + OFFSET, y = e.clientY + OFFSET;
        // temporarily show to measure
        const prevDisp = t.style.display;
        const prevVis = t.style.visibility;
        t.style.display = 'block';
        t.style.visibility = 'hidden';
        const rect = t.getBoundingClientRect();
        if (x + rect.width > vw) x = Math.max(8, vw - rect.width - 8);
        if (y + rect.height > vh) y = Math.max(8, vh - rect.height - 8);
        t.style.left = x + 'px';
        t.style.top = y + 'px';
        t.style.visibility = prevVis || '';
        t.style.display = prevDisp || 'block';
    };
})();