(() => {
    Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const ENDPOINT = '/verdata_split.php';
    const TZ = 'Europe/Oslo';
    const updatedEl = document.getElementById('updatedTxt');
    const rangeButtons = Array.from(document.querySelectorAll('button[data-range]'));

    function intervalFor(range) {
        if (range.endsWith('h')) {
            const h = parseInt(range, 10);
            if (h <= 6) return '5m';
            if (h <= 12) return '10m';
            return '10m';
        }
        if (range.endsWith('d')) {
            const d = parseInt(range, 10);
            if (d <= 3) return '30m';
            if (d <= 7) return '1h';
            return '3h';
        }
        return '10m';
    }

    function buildURL(range, interval) {
        const p = new URLSearchParams({range, interval, agg: 'avg', tz: TZ, use_cte: '0'});
        return `${ENDPOINT}?${p.toString()}`;
    }

    function downsample(points, maxN = 4000) {
        const n = points.length;
        if (n <= maxN) return points;
        const step = Math.ceil(n / maxN);
        const out = [];
        for (let i = 0; i < n; i += step) out.push(points[i]);
        return out;
    }

    const makeXY = (rows, key) =>
        rows.map(r => {
            const y = r[key];
            return {x: new Date(r.t.replace(' ', 'T')), y: (y == null ? null : Number(y))};
        });

    async function fetchSeries(range) {
        const interval = intervalFor(range);
        const url = buildURL(range, interval);
        const t0 = performance.now();
        const res = await fetch(url, {cache: 'no-store'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const {rows = []} = await res.json();

        let tempBrygga = makeXY(rows, 'temp_brygga');
        let tempLia = makeXY(rows, 'temp_lia');
        let wtempSjo = makeXY(rows, 'wtemp_sjo');

        let windBrygga = makeXY(rows, 'wind_brygga');
        let gustBrygga = makeXY(rows, 'gust_brygga');
        let windLia = makeXY(rows, 'wind_lia');
        let gustLia = makeXY(rows, 'gust_lia');

        tempBrygga = downsample(tempBrygga);
        tempLia = downsample(tempLia);
        wtempSjo = downsample(wtempSjo);
        windBrygga = downsample(windBrygga);
        gustBrygga = downsample(gustBrygga);
        windLia = downsample(windLia);
        gustLia = downsample(gustLia);

        const ms = Math.round(performance.now() - t0);
        updatedEl.textContent = `Oppdatert ${new Date().toLocaleTimeString('nb-NO')} • ${range} @ ${interval} • ${ms} ms`;

        return {tempBrygga, tempLia, wtempSjo, windBrygga, gustBrygga, windLia, gustLia};
    }

    const timeScale = {
        type: 'time',
        time: {
            unit: 'minute',
            tooltipFormat: 'dd.MM HH:mm',
            displayFormats: {minute: 'HH:mm', hour: 'HH:mm', day: 'dd.MM'}
        },
        ticks: {maxRotation: 0, autoSkipPadding: 24}
    };
    const commonOpts = {
        responsive: true,
        maintainAspectRatio: false,
        parsing: true,
        normalized: true,
        animation: false,
        spanGaps: true,
        plugins: {
            legend: {display: true},
            decimation: {enabled: true, algorithm: 'lttb'},
            tooltip: {mode: 'index', intersect: false}
        },
        scales: {x: timeScale, y: {beginAtZero: false}}
    };

    const tempChart = new Chart(document.getElementById('tempChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                {label: 'Brygga (°C)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                {label: 'Liafjellet (°C)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                {label: 'Sjøtemp (°C)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25, borderDash: [4, 3]}
            ]
        },
        options: {
            ...commonOpts,
            plugins: {
                ...commonOpts.plugins,
                tooltip: {
                    ...commonOpts.plugins.tooltip,
                    callbacks: {label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed?.(1) ?? '—'} °C`}
                }
            }
        }
    });

    const windChart = new Chart(document.getElementById('windChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                {label: 'Vind Brygga (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                {
                    label: 'Kast Brygga (m/s)',
                    data: [],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.25,
                    borderDash: [6, 4]
                },
                {label: 'Vind Lia (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                {
                    label: 'Kast Lia (m/s)',
                    data: [],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.25,
                    borderDash: [6, 4]
                }
            ]
        },
        options: {
            ...commonOpts,
            scales: {x: timeScale, y: {beginAtZero: true, suggestedMax: 20}},
            plugins: {
                ...commonOpts.plugins,
                tooltip: {
                    ...commonOpts.plugins.tooltip,
                    callbacks: {label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed?.(1) ?? '—'} m/s`}
                }
            }
        }
    });

    async function render(range) {
        const s = await fetchSeries(range);
        tempChart.data.datasets[0].data = s.tempBrygga;
        tempChart.data.datasets[1].data = s.tempLia;
        tempChart.data.datasets[2].data = s.wtempSjo;
        tempChart.update('none');

        windChart.data.datasets[0].data = s.windBrygga;
        windChart.data.datasets[1].data = s.gustBrygga;
        windChart.data.datasets[2].data = s.windLia;
        windChart.data.datasets[3].data = s.gustLia;
        windChart.update('none');
    }

    function setActive(range) {
        rangeButtons.forEach(b => b.classList.toggle('active', b.dataset.range === range));
    }

    rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRange = btn.dataset.range;
            setActive(currentRange);
            render(currentRange).catch(console.error);
        });
    });

    let currentRange = '24h';
    setActive(currentRange);
    render(currentRange).catch(console.error);
    setInterval(() => render(currentRange).catch(console.error), 60_000);
})();