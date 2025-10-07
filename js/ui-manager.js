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
            btn.addEventListener('click', (e) => {
                // Handle range change for chart buttons
                const range = e.target.dataset.range;
                if (range) {
                    // Remove active class from all buttons
                    document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    e.target.classList.add('active');

                    // Trigger chart update if chart manager exists
                    console.log(`Range changed to: ${range}`);
                }
            });
        });

        // Window beforeunload cleanup - remove undefined timer references
        window.addEventListener("beforeunload", () => {
            // Managers now handle their own cleanup
            console.log('Page unloading - cleanup handled by individual managers');
        });
    }
}
