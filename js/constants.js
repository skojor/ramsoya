// Application constants and configuration
const CONFIG = {
    WIND_ARROW_MODE: 'to',
    IMG_URL: "siste.jpg",
    WEATHER_URL: "getweather_overlay.php",
    IMAGE_INTERVAL_MS: 20_000,
    WEATHER_INTERVAL_MS: 30_000,
    MOON_URL: "/met_moon_proxy.php?lat=64.33&lon=10.41",
    FORECAST_URL: "/met_forecast_proxy.php?lat=64.32785&lon=10.41549",
    SUNRISE_URL: "/sunrise_proxy.php?type=all-events",
    ICON_BASE: "ikoner/yr/",
    TZ_OSLO: "Europe/Oslo"
};

const YR_SYMBOL_MAP = {
    clearsky_day: '01d',
    clearsky_night: '01n',
    // ... rest of the symbol mapping
};

const iconDefault = `${CONFIG.ICON_BASE}04.svg`;

