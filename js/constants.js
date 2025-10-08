// Application constants and configuration
export const CONFIG = {
    // Core weather settings
    WIND_ARROW_MODE: 'to',
    WIND_FLIP: true,  // Wind direction configuration
    IMAGE_URL: "siste.jpg", // Fixed: renamed from IMG_URL and removed leading slash for consistency
    WEATHER_URL: "/data/getweather_overlay.php",
    IMAGE_INTERVAL_MS: 20_000,
    WEATHER_INTERVAL_MS: 30_000,
    MOON_URL: "/api/met_moon_proxy.php?lat=64.33&lon=10.41",
    FORECAST_URL: "/api/met_forecast_proxy.php?lat=64.32785&lon=10.41549",
    SUNRISE_URL: "/api/sunrise_proxy.php?type=all-events",
    ICON_BASE: "ikoner/yr/",
    TZ_OSLO: "Europe/Oslo",

    // Location coordinates
    LOCATION: {
        LAT: 64.3278592,
        LON: 10.4155161,
        NAME: "Ramsøyvika"
    },

    // Refresh intervals (in milliseconds)
    INTERVALS: {
        IMAGE_REFRESH: 20_000,        // 20 seconds
        WEATHER_REFRESH: 30_000,      // 30 seconds
        IMAGE_STATUS: 1_000,          // 1 second
        MOON_REFRESH: 15 * 60_000,    // 15 minutes
        FORECAST_REFRESH: 30 * 60_000, // 30 minutes
        SOLAR_REFRESH: 30 * 60_000,   // 30 minutes
        AIS_REFRESH: 20_000,          // 20 seconds
        ADSB_REFRESH: 20_000,         // 20 seconds
        TIDAL_REFRESH: 30 * 60_000,   // 30 minutes
        ENTUR_REFRESH: 60_000,        // 1 minute
        CHART_REFRESH: 60_000         // 1 minute
    },

    // API endpoints
    ENDPOINTS: {
        AIS: "/data/getaislist.php",
        ADSB: "/api/adsb_proxy.php",
        TIDAL: "https://vannstand.kartverket.no/tideapi.php",
        ENTUR: "/api/entur_proxy.php",
        CHARTS: "/data/verdata_split.php",
        IMAGE_METADATA: "/api/image_metadata_proxy.php"
    },

    // ADS-B settings
    ADSB: {
        MAX_DIST_KM: 100,
        MAX_SEEN_S: 60
    },

    // Chart settings
    CHARTS: {
        MAX_POINTS: 4000,
        DEVICE_PIXEL_RATIO_MAX: 2,
        DEFAULT_RANGE: '24h',
        INTERVALS: {
            '6h': '5m',
            '12h': '10m',
            '24h': '10m',
            '3d': '30m',
            '7d': '1h'
        }
    },

    // UI thresholds
    STATUS: {
        IMAGE_AGE_WARN_SEC: 120,
        IMAGE_AGE_BAD_SEC: 300
    },

    // External service URLs
    EXTERNAL: {
        MARINE_TRAFFIC: "https://www.marinetraffic.com/en/ais/details/ships/mmsi:",
        FLIGHTRADAR24: "https://www.flightradar24.com/64.32,10.41/8",
        FLIGHT_AWARE: "https://flightaware.com/live/flight/",
        GOOGLE_FLIGHT_SEARCH: "https://www.google.com/search?q=",
        RAMSOY_ISHIP: "https://ramsoy.iship.no"
    }
};

export const YR_SYMBOL_MAP = {
    clearsky_day: '01d',
    clearsky_night: '01n',
    clearsky_polartwilight: '01m',
    fair_day: '02d',
    fair_night: '02n',
    fair_polartwilight: '02m',
    partlycloudy_day: '03d',
    partlycloudy_night: '03n',
    partlycloudy_polartwilight: '03m',
    cloudy: '04',
    lightrainshowers_day: '40d',
    lightrainshowers_night: '40n',
    lightrainshowers_polartwilight: '40m',
    rainshowers_day: '05d',
    rainshowers_night: '05n',
    rainshowers_polartwilight: '05m',
    heavyrainshowers_day: '41d',
    heavyrainshowers_night: '41n',
    heavyrainshowers_polartwilight: '41m',
    lightrainshowersandthunder_day: '24d',
    lightrainshowersandthunder_night: '24n',
    lightrainshowersandthunder_polartwilight: '24m',
    rainshowersandthunder_day: '06d',
    rainshowersandthunder_night: '06n',
    rainshowersandthunder_polartwilight: '06m',
    heavyrainshowersandthunder_day: '25d',
    heavyrainshowersandthunder_night: '25n',
    heavyrainshowersandthunder_polartwilight: '25m',
    lightsleetshowers_day: '42d',
    lightsleetshowers_night: '42n',
    lightsleetshowers_polartwilight: '42m',
    sleetshowers_day: '07d',
    sleetshowers_night: '07n',
    sleetshowers_polartwilight: '07m',
    heavysleetshowers_day: '43d',
    heavysleetshowers_night: '43n',
    heavysleetshowers_polartwilight: '43m',
    lightsleetshowersandthunder_day: '26d',
    lightsleetshowersandthunder_night: '26n',
    lightsleetshowersandthunder_polartwilight: '26m',
    sleetshowersandthunder_day: '20d',
    sleetshowersandthunder_night: '20n',
    sleetshowersandthunder_polartwilight: '20m',
    heavysleetshowersandthunder_day: '27d',
    heavysleetshowersandthunder_night: '27n',
    heavysleetshowersandthunder_polartwilight: '27m',
    lightsnowshowers_day: '44d',
    lightsnowshowers_night: '44n',
    lightsnowshowers_polartwilight: '44m',
    snowshowers_day: '08d',
    snowshowers_night: '08n',
    snowshowers_polartwilight: '08m',
    heavysnowshowers_day: '45d',
    heavysnowshowers_night: '45n',
    heavysnowshowers_polartwilight: '45m',
    lightsnowshowersandthunder_day: '28d',
    lightsnowshowersandthunder_night: '28n',
    lightsnowshowersandthunder_polartwilight: '28m',
    snowshowersandthunder_day: '21d',
    snowshowersandthunder_night: '21n',
    snowshowersandthunder_polartwilight: '21m',
    heavysnowshowersandthunder_day: '29d',
    heavysnowshowersandthunder_night: '29n',
    heavysnowshowersandthunder_polartwilight: '29m',
    lightrain: '46',
    rain: '09',
    heavyrain: '10',
    lightrainandthunder: '30',
    rainandthunder: '22',
    heavyrainandthunder: '11',
    lightsleet: '47',
    sleet: '12',
    heavysleet: '48',
    lightsleetandthunder: '31',
    sleetandthunder: '23',
    heavysleetandthunder: '32',
    lightsnow: '49',
    snow: '13',
    heavysnow: '50',
    lightsnowandthunder: '33',
    snowandthunder: '14',
    heavysnowandthunder: '34',
    fog: '15'
};

export const iconDefault = `${CONFIG.ICON_BASE}04.svg`;
