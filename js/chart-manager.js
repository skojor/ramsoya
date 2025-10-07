// Weather statistics chart management
export class ChartManager {
    constructor() {
        Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        this.endpoint = '/verdata_split.php';
        this.tz = 'Europe/Oslo';
        this.currentRange = '24h';
        this.refreshMs = 60_000;

        this.elements = {
            updated: () => document.getElementById('updatedTxt'),
            rangeButtons: () => Array.from(document.querySelectorAll('button[data-range]'))
        };

        this.init();
    }

    init() {
        this.setupCharts();
        this.setupEventListeners();
        this.setActive(this.currentRange);
        this.render(this.currentRange).catch(console.error);
        setInterval(() => this.render(this.currentRange).catch(console.error), this.refreshMs);
    }

    intervalFor(range) {
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

    buildURL(range, interval) {
        const p = new URLSearchParams({range, interval, agg: 'avg', tz: this.tz, use_cte: '0'});
        return `${this.endpoint}?${p.toString()}`;
    }

    downsample(points, maxN = 4000) {
        const n = points.length;
        if (n <= maxN) return points;
        const step = Math.ceil(n / maxN);
        const out = [];
        for (let i = 0; i < n; i += step) out.push(points[i]);
        return out;
    }

    makeXY(rows, key) {
        return rows.map(r => {
            const y = r[key];
            return {x: new Date(r.t.replace(' ', 'T')), y: (y == null ? null : Number(y))};
        });
    }

    async fetchSeries(range) {
        const interval = this.intervalFor(range);
        const url = this.buildURL(range, interval);
        const t0 = performance.now();
        const res = await fetch(url, {cache: 'no-store'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const {rows = []} = await res.json();

        let tempBrygga = this.downsample(this.makeXY(rows, 'temp_brygga'));
        let tempLia = this.downsample(this.makeXY(rows, 'temp_lia'));
        let wtempSjo = this.downsample(this.makeXY(rows, 'wtemp_sjo'));
        let windBrygga = this.downsample(this.makeXY(rows, 'wind_brygga'));
        let gustBrygga = this.downsample(this.makeXY(rows, 'gust_brygga'));
        let windLia = this.downsample(this.makeXY(rows, 'wind_lia'));
        let gustLia = this.downsample(this.makeXY(rows, 'gust_lia'));

        const ms = Math.round(performance.now() - t0);
        this.elements.updated().textContent = `Oppdatert ${new Date().toLocaleTimeString('nb-NO')} • ${range} @ ${interval} • ${ms} ms`;

        return {tempBrygga, tempLia, wtempSjo, windBrygga, gustBrygga, windLia, gustLia};
    }

    setupCharts() {
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

        this.tempChart = new Chart(document.getElementById('tempChart').getContext('2d'), {
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

        this.windChart = new Chart(document.getElementById('windChart').getContext('2d'), {
            type: 'line',
            data: {
                datasets: [
                    {label: 'Vind Brygga (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                    {label: 'Kast Brygga (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25, borderDash: [6, 4]},
                    {label: 'Vind Lia (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25},
                    {label: 'Kast Lia (m/s)', data: [], borderWidth: 2, pointRadius: 0, tension: 0.25, borderDash: [6, 4]}
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
    }

    async render(range) {
        const s = await this.fetchSeries(range);
        this.tempChart.data.datasets[0].data = s.tempBrygga;
        this.tempChart.data.datasets[1].data = s.tempLia;
        this.tempChart.data.datasets[2].data = s.wtempSjo;
        this.tempChart.update('none');

        this.windChart.data.datasets[0].data = s.windBrygga;
        this.windChart.data.datasets[1].data = s.gustBrygga;
        this.windChart.data.datasets[2].data = s.windLia;
        this.windChart.data.datasets[3].data = s.gustLia;
        this.windChart.update('none');
    }

    setActive(range) {
        this.elements.rangeButtons().forEach(b => b.classList.toggle('active', b.dataset.range === range));
    }

    setupEventListeners() {
        this.elements.rangeButtons().forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentRange = btn.dataset.range;
                this.setActive(this.currentRange);
                this.render(this.currentRange).catch(console.error);
            });
        });
    }
}
