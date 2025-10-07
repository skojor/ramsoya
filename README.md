# Ramsøyvika Weather Station

A real-time weather monitoring dashboard for Ramsøyvika, Norway, featuring live webcam imagery with weather overlays and comprehensive environmental data.

## Features

- **Live webcam** with weather overlay (20-second refresh)
- **Current weather conditions** and 24-hour forecast
- **Marine traffic tracking** (AIS) showing nearby vessels
- **Aircraft tracking** (ADS-B) displaying flights in the area
- **Astronomical data** (moon phases, sunrise/sunset times)
- **Tidal information** for the coastal location
- **Public transport** schedules for local ferry services
- **Weather statistics** with interactive charts (6h to 7d ranges)

## Technical Stack

- **Frontend**: Modern ES6 modules, Chart.js for visualizations
- **Backend**: PHP proxies for external API integration
- **Data Sources**: Norwegian Meteorological Institute, Marine Traffic, ADS-B networks, Entur
- **Responsive design** optimized for both desktop and mobile

## Quick Start

1. Ensure PHP is installed with required extensions
2. Install dependencies: `composer install`
3. Configure API credentials in `private/` directory
4. Serve from web root or configure virtual host

## File Structure

```
/
├── index.html              # Main application
├── api/                    # PHP API proxies
├── data/                   # Data processing scripts  
├── js/                     # Frontend JavaScript modules
├── ikoner/                 # Weather and UI icons
└── styles.css              # Application styles
```

Built for the coastal community of Ramsøyvika with ❤️
