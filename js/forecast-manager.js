// Weather forecast management
import { CONFIG, YR_SYMBOL_MAP, iconDefault } from './constants.js';
import { hourFmt, correctedNowMs } from './utils.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { UIComponents } from './ui-components.js';

export class ForecastManager {
    constructor() {
        this.forecastHourlyEl = document.getElementById("forecastHourly");

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    // Parse an ISO timestamp string and return epoch ms, treating timestamps without
    // an explicit timezone as UTC. This avoids client-local parsing differences.
    parseIsoToUtcMs(iso) {
        if (!iso) return NaN;
        const s = String(iso).trim();
        // If string already ends with Z or an explicit timezone offset, parse directly
        if (/(?:Z|[+\-]\d{2}:\d{2})$/i.test(s)) return Date.parse(s);
        // Otherwise treat as UTC by appending Z
        return Date.parse(s + 'Z');
    }

    setupStateSubscriptions() {
        // Update UI when forecast data changes
        appState.subscribe('weather.forecast', (forecastData) => {
            this.renderHourly(forecastData);
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.forecast !== undefined) {
                this.updateLoadingState(loadingStates.forecast);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            const loader = UIComponents.createLoader('Henter værutsikt...');
            UIComponents.replaceContent(this.forecastHourlyEl, loader);
        }
    }

    iconForSymbol(symbol_code) {
        if (!symbol_code) return null;
        const id = YR_SYMBOL_MAP[symbol_code];
        return id ? `${CONFIG.ICON_BASE}${id}.svg` : iconDefault;
    }

    pickHourlySymbol(item) {
        // Try both the old (summary) and new (details) API formats for maximum compatibility
        return item?.data?.next_1_hours?.summary?.symbol_code ||
            item?.data?.next_6_hours?.summary?.symbol_code ||
            item?.data?.next_12_hours?.summary?.symbol_code ||
            item?.data?.next_1_hours?.details?.symbol_code ||
            item?.data?.next_6_hours?.details?.symbol_code ||
            item?.data?.next_12_hours?.details?.symbol_code || null;
    }

    renderHourly(series) {
        if (!series || !Array.isArray(series)) {
            this.forecastHourlyEl.textContent = 'Ingen værutsikt tilgjengelig.';
            return;
        }

        // Use server-provided time as authoritative baseline to avoid client clock skew
        // Prefer forecast-specific server timestamp if present, otherwise use the global
        // server-corrected time (correctedNowMs) which is set when any handler provided
        // a serverNowMs value.
        const serverNowMs = appState.getState('weather.forecastServerNow');
        const baseNow = (Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : correctedNowMs());

        // Keep existing lookahead (3h) but apply to server-corrected now
        const LOOKAHEAD_MS = 2 * 60 * 60 * 1000; // 3 hours
        const now = baseNow + LOOKAHEAD_MS;

        const upcoming = series.filter(it => this.parseIsoToUtcMs(it.time) >= now);
        const cards = [];

        for (let i = 0; i < upcoming.length && cards.length < 6; i += 4) {
            const it = upcoming[i];
            const hasPeriod = it?.data?.next_1_hours || it?.data?.next_6_hours || it?.data?.next_12_hours;
            if (!hasPeriod) continue;

            const cardData = this.createForecastCardData(it);
            const card = UIComponents.createForecastCard(cardData);
            cards.push(card);
        }

        UIComponents.replaceContent(this.forecastHourlyEl, cards);
    }

    createForecastCardData(item) {
        const tUTC = new Date(this.parseIsoToUtcMs(item.time));
        const tLocal = new Date(tUTC.toLocaleString('en-US', { timeZone: CONFIG.TZ_OSLO }));
        const timeLabel = hourFmt.format(tLocal);

        const T = item?.data?.instant?.details?.air_temperature;
        const tDisp = Number.isFinite(T) ? `${Math.round(T)}°` : '–';

        const p1 = item?.data?.next_1_hours?.details?.precipitation_amount;
        const p6 = item?.data?.next_6_hours?.details?.precipitation_amount;
        const p12 = item?.data?.next_12_hours?.details?.precipitation_amount;
        const precip = (p1 ?? p6 ?? p12 ?? 0);
        const pDisp = `${(+precip).toFixed(1)} mm`;

        const d = item?.data?.instant?.details || {};
        const wind = d.wind_speed;
        const gust = d.wind_speed_of_gust;
        const windFrom = d.wind_from_direction;

        const bf = this.calculateBeaufortScale(wind ?? -1);
        const windTxt = this.formatWindText(wind, gust, bf);
        const arrow = (Number.isFinite(wind) && Number.isFinite(windFrom)) ?
            window.windBarbSVG(wind, windFrom) : "";

        const sym = this.pickHourlySymbol(item);
        const iconPath = this.iconForSymbol(sym);

        return { timeLabel, tDisp, pDisp, windTxt, arrow, iconPath, sym };
    }

    calculateBeaufortScale(ms) {
        const b = ms < 0.5 ? 0 : ms < 1.6 ? 1 : ms < 3.4 ? 2 : ms < 5.5 ? 3 :
                 ms < 8.0 ? 4 : ms < 10.8 ? 5 : ms < 13.9 ? 6 : ms < 17.2 ? 7 :
                 ms < 20.8 ? 8 : ms < 24.5 ? 9 : ms < 28.5 ? 10 : ms < 32.7 ? 11 : 12;
        const txt = ["stille", "flau vind", "svak vind", "lett bris", "laber bris",
                    "frisk bris", "liten kuling", "stiv kuling", "sterk kuling",
                    "liten storm", "full storm", "sterk storm", "orkan"][b];
        return { bft: b, txt };
    }

    formatWindText(wind, gust, bf) {
        if (wind == null) return "– m/s";

        let text = `${Math.round(wind)} m/s`;
        if (gust) text += ` (kast ${Math.round(gust)})`;
        if (Number.isFinite(wind)) text += ` – ${bf.txt}`;

        return text;
    }

    async loadForecastHourly() {
        try {
            const data = await apiClient.get(CONFIG.FORECAST_URL, 'forecast');

            if (data) {
                if (data.serverNowMs) {
                    appState.setState('weather.forecastServerNow', data.serverNowMs, { silent: true });
                    // Mirror to a global server.nowMs and compute a clock delta for global use
                    const serverNow = Number(data.serverNowMs);
                    appState.setState('server.nowMs', serverNow, { silent: true });
                    appState.setState('server.clockDeltaMs', Date.now() - serverNow, { silent: true });
                }
                const series = data?.properties?.timeseries || [];
                if (series.length > 0) {
                    appState.setState('weather.forecast', series);
                    // Store server timestamp if provided so we can base "now" comparisons on it

                } else {
                    console.warn('No forecast data available in response');
                    appState.setState('weather.forecast', null);
                }
            } else {
                console.warn('No forecast data received');
                appState.setState('weather.forecast', null);
            }

        } catch (error) {
            console.error("Forecast fetch error:", error);
            appState.setState('weather.forecast', null);

            // Show error in UI
            const errorEl = UIComponents.createError('Kunne ikke hente varsel', () => this.loadForecastHourly());
            UIComponents.replaceContent(this.forecastHourlyEl, errorEl);
        }
    }
}
