// UI management and global event handlers
export class UIManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    updateStatus(message, isError = false) {
        const statusEl = document.getElementById('status');
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = message;
        }
        if (statusEl) {
            statusEl.className = `status-pill ${isError ? 'bad' : 'ok'}`;
        }
    }

    toggleWeatherOverlay() {
        const overlay = document.getElementById('weatherOverlay');
        if (overlay) {
            overlay.hidden = !overlay.hidden;
        }
    }

    setupEventListeners() {
        // Button event handlers for time range selection
        document.querySelectorAll('[data-range]').forEach(btn => {
            btn.addEventListener('click', handleRangeChange);
        });

        // Window beforeunload cleanup
        window.addEventListener("beforeunload", () => {
            clearInterval(imgTimer);
            clearInterval(weatherTimer);
            clearInterval(statusTimer);
            clearInterval(moonTimer);
            clearInterval(fcTimer);
            clearInterval(sunTimer);
        });
    }
}
