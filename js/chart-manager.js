// Weather statistics chart management
import { CONFIG } from './constants.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class ChartManager {
    constructor() {
        Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.CHARTS.DEVICE_PIXEL_RATIO_MAX);

        this.endpoint = CONFIG.ENDPOINTS.CHARTS;
        this.tz = CONFIG.TZ_OSLO;
        this.currentRange = CONFIG.CHARTS.DEFAULT_RANGE;
        this.refreshMs = CONFIG.INTERVALS.CHART_REFRESH;

        this.elements = {
            updated: () => document.getElementById('updatedTxt'),
            rangeButtons: () => Array.from(document.querySelectorAll('button[data-range]'))
        };

        // Subscribe to state changes
        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Update charts when chart data changes
        appState.subscribe('charts.data', (chartData) => {
            if (chartData) {
                this.updateCharts(chartData);
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.charts !== undefined) {
                this.updateLoadingState(loadingStates.charts);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            UIComponents.updateContent(this.elements.updated(), 'Laster diagram...');
        }
    }

    init() {
        this.setupCharts();
        this.setupEventListeners();
        this.setActive(this.currentRange);
        this.render(this.currentRange);
        setInterval(() => this.render(this.currentRange), this.refreshMs);
    }

    intervalFor(range) {
        // Use centralized chart interval configuration
        if (range.endsWith('h')) {
            const h = parseInt(range, 10);
            if (h <= 6) return CONFIG.CHARTS.INTERVALS['6h'];
            if (h <= 12) return CONFIG.CHARTS.INTERVALS['12h'];
            return CONFIG.CHARTS.INTERVALS['24h'];
        }
        if (range.endsWith('d')) {
            const d = parseInt(range, 10);
            if (d <= 3) return CONFIG.CHARTS.INTERVALS['3d'];
            if (d <= 7) return CONFIG.CHARTS.INTERVALS['7d'];
            return CONFIG.CHARTS.INTERVALS['7d'];
        }
        return CONFIG.CHARTS.INTERVALS['24h'];
    }

    buildURL(range, interval) {
        const p = new URLSearchParams({range, interval, agg: 'avg', tz: this.tz, use_cte: '0'});
        return `${this.endpoint}?${p.toString()}`;
    }

    downsample(points, maxN = CONFIG.CHARTS.MAX_POINTS) {
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
        try {
            const interval = this.intervalFor(range);
            const url = this.buildURL(range, interval);
            const t0 = performance.now();

            const responseData = await apiClient.get(url, 'charts');

            // Handle both null responses and proper data structure
            let rows = [];
            if (responseData === null) {
                console.warn('Charts API returned empty response');
                rows = [];
            } else if (responseData && Array.isArray(responseData.rows)) {
                rows = responseData.rows;
            } else if (responseData && typeof responseData === 'object') {
                console.warn('Unexpected chart data structure:', responseData);
                rows = [];
            } else {
                console.warn('Invalid chart response type:', typeof responseData);
                rows = [];
            }

            let tempBrygga = this.downsample(this.makeXY(rows, 'temp_brygga'));
            let tempLia = this.downsample(this.makeXY(rows, 'temp_lia'));
            let wtempSjo = this.downsample(this.makeXY(rows, 'wtemp_sjo'));
            let windBrygga = this.downsample(this.makeXY(rows, 'wind_brygga'));
            let gustBrygga = this.downsample(this.makeXY(rows, 'gust_brygga'));
            let windLia = this.downsample(this.makeXY(rows, 'wind_lia'));
            let gustLia = this.downsample(this.makeXY(rows, 'gust_lia'));

            const ms = Math.round(performance.now() - t0);
            UIComponents.updateContent(this.elements.updated(),
                `Oppdatert ${new Date().toLocaleTimeString('nb-NO')} • ${range} @ ${interval} • ${ms} ms`);

            const chartData = {tempBrygga, tempLia, wtempSjo, windBrygga, gustBrygga, windLia, gustLia};

            // Update state instead of direct chart update
            appState.setState('charts.data', chartData);

            return chartData;
        } catch (error) {
            console.error("Chart fetch error:", error);
            UIComponents.updateContent(this.elements.updated(), 'Feil ved henting av data');
            throw error;
        }
    }

    updateCharts(data) {
        if (this.tempChart && this.windChart) {
            this.tempChart.data.datasets[0].data = data.tempBrygga;
            this.tempChart.data.datasets[1].data = data.tempLia;
            this.tempChart.data.datasets[2].data = data.wtempSjo;
            this.tempChart.update('none');

            this.windChart.data.datasets[0].data = data.windBrygga;
            this.windChart.data.datasets[1].data = data.gustBrygga;
            this.windChart.data.datasets[2].data = data.windLia;
            this.windChart.data.datasets[3].data = data.gustLia;
            this.windChart.update('none');
        }
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
        try {
            await this.fetchSeries(range);
        } catch (error) {
            // Error already reported in fetchSeries
            console.warn('Chart render failed for range:', range);
        }
    }

    setActive(range) {
        this.elements.rangeButtons().forEach(b => b.classList.toggle('active', b.dataset.range === range));
    }

    setupEventListeners() {
        this.elements.rangeButtons().forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentRange = btn.dataset.range;
                this.setActive(this.currentRange);
                this.render(this.currentRange);
            });
        });
    }
}
