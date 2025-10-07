// Weather forecast management
import { CONFIG, YR_SYMBOL_MAP, iconDefault } from './constants.js';
import { norm360, hourFmt } from './utils.js';
import { appState } from './state-manager.js';
import { reportError } from './error-handler.js';

export class ForecastManager {
    constructor() {
        this.forecastHourlyEl = document.getElementById("forecastHourly");

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Update UI when forecast data changes
        appState.subscribe('weather.forecast', (forecastData) => {
            if (forecastData) {
                this.renderHourly(forecastData);
            }
        });
    }

    iconForSymbol(symbol_code) {
        if (!symbol_code) return null;
        const id = YR_SYMBOL_MAP[symbol_code];
        return id ? `${CONFIG.ICON_BASE}${id}.svg` : iconDefault;
    }

    pickHourlySymbol(item) {
        return item?.data?.next_1_hours?.summary?.symbol_code ||
            item?.data?.next_6_hours?.summary?.symbol_code ||
            item?.data?.next_12_hours?.summary?.symbol_code || null;
    }

    renderHourly(series) {
        const now = Date.now();
        const upcoming = series.filter(it => new Date(it.time).getTime() >= now);
        const cards = [];

        for (let i = 0; i < upcoming.length && cards.length < 6; i += 4) {
            const it = upcoming[i];
            const hasPeriod = it?.data?.next_1_hours || it?.data?.next_6_hours || it?.data?.next_12_hours;
            if (!hasPeriod) continue;

            const tUTC = new Date(it.time);
            const tLocal = new Date(tUTC.toLocaleString('en-US', { timeZone: CONFIG.TZ_OSLO }));
            const timeLabel = hourFmt.format(tLocal);

            const T = it?.data?.instant?.details?.air_temperature;
            const tDisp = Number.isFinite(T) ? `${Math.round(T)}°` : '–';

            const p1 = it?.data?.next_1_hours?.details?.precipitation_amount;
            const p6 = it?.data?.next_6_hours?.details?.precipitation_amount;
            const p12 = it?.data?.next_12_hours?.details?.precipitation_amount;
            const precip = (p1 ?? p6 ?? p12 ?? 0);
            const pDisp = `${(+precip).toFixed(1)} mm`;

            const d = it?.data?.instant?.details || {};
            const wind = d.wind_speed;
            const gust = d.wind_speed_of_gust;
            const windFrom = d.wind_from_direction;

            const bf = (function(ms) {
                const b = ms < 0.5 ? 0 : ms < 1.6 ? 1 : ms < 3.4 ? 2 : ms < 5.5 ? 3 : ms < 8.0 ? 4 : ms < 10.8 ? 5 : ms < 13.9 ? 6 : ms < 17.2 ? 7 : ms < 20.8 ? 8 : ms < 24.5 ? 9 : ms < 28.5 ? 10 : ms < 32.7 ? 11 : 12;
                const txt = ["stille", "flau vind", "svak vind", "lett bris", "laber bris", "frisk bris", "liten kuling", "stiv kuling", "sterk kuling", "liten storm", "full storm", "sterk storm", "orkan"][b];
                return { bft: b, txt };
            })(wind ?? -1);

            let bearing = null;
            if (windFrom != null) {
                bearing = (CONFIG.WIND_ARROW_MODE === 'from') ? windFrom : norm360(windFrom + 180);
            }
            const rot = (bearing == null) ? null : norm360(bearing - 90);

            const arrow = (Number.isFinite(wind) && Number.isFinite(windFrom)) ? window.windBarbSVG(wind, windFrom) : "";

            const windTxt = (wind == null) ? "– m/s" : `${Math.round(wind)} m/s${gust ? ` (kast ${Math.round(gust)})` : ""}${Number.isFinite(wind) ? ` – ${bf.txt}` : ""}`;

            const sym = this.pickHourlySymbol(it);
            const iconPath = this.iconForSymbol(sym);

            cards.push({ timeLabel, tDisp, pDisp, windTxt, arrow, iconPath, sym });
        }

        this.forecastHourlyEl.innerHTML = '';
        for (const c of cards) {
            const el = document.createElement('div');
            el.className = 'fcH-card';
            el.innerHTML = `<div class="fcH-time">${c.timeLabel}</div><div class="fcH-icon">${c.iconPath ? `<img src="${c.iconPath}" alt="${c.sym}" onerror="this.onerror=null;this.src='${CONFIG.ICON_BASE}04.svg';this.alt='cloudy';">` : '—'}</div><div class="fcH-t">${c.tDisp}</div><div class="fcH-mm">${c.pDisp}</div><div class="fcH-wind">${c.windTxt} ${c.arrow}</div>`;
            this.forecastHourlyEl.appendChild(el);
        }
    }

    async loadForecastHourly() {
        try {
            const res = await fetch(CONFIG.FORECAST_URL, { cache: 'no-cache' });
            const raw = await res.text();

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: Failed to fetch forecast data`);
            }

            // Check for empty response
            if (!raw || raw.trim().length === 0) {
                console.warn('Empty forecast response received');
                appState.setState('weather.forecast', null);
                return;
            }

            let json;
            try {
                json = JSON.parse(raw);
            } catch (parseError) {
                // Don't report JSON parsing errors as critical - just log them
                console.warn('Forecast API returned invalid JSON:', parseError.message);
                appState.setState('weather.forecast', null);
                return;
            }

            const series = json?.properties?.timeseries || [];
            if (!series.length) {
                console.warn('No forecast data available in response');
                appState.setState('weather.forecast', null);
                return;
            }

            // Update state instead of direct rendering
            appState.setState('weather.forecast', series);

        } catch (error) {
            // Only report non-parsing errors as critical
            if (!error.message.includes('JSON') && !error.message.includes('Unexpected token') && !error.message.includes('Invalid JSON')) {
                reportError('forecast', error, 'Failed to load hourly forecast data');
            } else {
                console.warn('Forecast parsing issue:', error.message);
            }
            appState.setState('weather.forecast', null);
            this.forecastHourlyEl.textContent = 'Kunne ikke hente varsel.';
        }
    }
}
