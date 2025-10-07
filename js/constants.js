// Application constants and configuration
export const CONFIG = {
    // Core weather settings
    WIND_ARROW_MODE: 'to',
    WIND_FLIP: true,  // Wind direction configuration
    IMAGE_URL: "siste.jpg", // Fixed: renamed from IMG_URL and removed leading slash for consistency
    WEATHER_URL: "api/getweather_overlay.php",
    IMAGE_INTERVAL_MS: 20_000,
    WEATHER_INTERVAL_MS: 30_000,
    MOON_URL: "/api/met_moon_proxy.php?lat=64.33&lon=10.41",
    FORECAST_URL: "/met_forecast_proxy.php?lat=64.32785&lon=10.41549",
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
        AIS: "data/getaislist.php",
        ADSB: "/api/adsb_proxy.php",
        TIDAL: "https://vannstand.kartverket.no/tideapi.php",
        ENTUR: "api/entur_api.php",
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
        GOOGLE_FLIGHT_SEARCH: "https://www.google.com/search?q=",
        RAMSOY_ISHIP: "https://ramsoy.iship.no"
    }
};
