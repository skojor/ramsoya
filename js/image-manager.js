// Image management and overlay functionality
import { CONFIG } from './constants.js';
import { bust, humanAge } from './utils.js';
import { visibilityManager } from './visibility-manager.js';
import { apiClient } from './api-client.js';
import { appState } from './state-manager.js';

export class ImageManager {
    constructor() {
        this.imageEl = document.getElementById("cam");
        this.statusEl = document.getElementById("status");
        this.statusText = document.getElementById("statusText");
        this.refreshMs = CONFIG.INTERVALS.IMAGE_REFRESH;
        this.imageCaptureTs = 0;
        // serverClockDelta = Date.now() - serverNowMs (ms). If present, use to compute server-corrected "now"
        this.serverClockDelta = null;

        this.init();
    }

    init() {
        // Initial loads
        this.refreshImage();

        // Setup visibility-aware interval for image updates
        visibilityManager.setInterval('image',
            () => this.refreshImage(),
            this.refreshMs,
            5 // 5x slower when hidden (20s -> 100s) - most bandwidth intensive
        );

        // Update status display every second
        visibilityManager.setInterval('image-status',
            () => this.updateStatus(),
            CONFIG.INTERVALS.IMAGE_STATUS, // 1 second normally
            3 // 3x slower when hidden (1s -> 3s)
        );
    }

    refreshImage() {
        const img = new Image();
        img.onload = async () => {
            this.imageEl.src = img.src;
            await this.updateImageCaptureTime();
            this.updateStatus();
        };
        img.onerror = () => {
            console.warn('Failed to load image:', img.src);
        };
        img.src = bust(CONFIG.IMAGE_URL);
    }

    async updateImageCaptureTime() {
        try {
            const data = await apiClient.get(CONFIG.ENDPOINTS.IMAGE_METADATA);
            if (data && data.success && data.lastModified) {
                const t = new Date(data.lastModified).getTime();
                if (Number.isFinite(t)) {
                    this.imageCaptureTs = t;
                    // Also mirror to app state for any other consumers
                    appState.setState('image.captureTime', t, { silent: true });
                }
                // If server provided a serverNowMs, compute client->server delta
                if (data.serverNowMs && Number.isFinite(Number(data.serverNowMs))) {
                    const serverNow = Number(data.serverNowMs);
                    // delta = clientNow - serverNow
                    this.serverClockDelta = Date.now() - serverNow;
                    // Store in global app state so other modules can reuse
                    appState.setState('server.nowMs', serverNow, { silent: true });
                    appState.setState('server.clockDeltaMs', this.serverClockDelta, { silent: true });
                }
            }
        } catch (e) {
            console.error("Could not fetch image metadata:", e);
        }
    }

    updateStatus() {
        // Only use imageCaptureTs if available, otherwise show loading state
        if (!this.imageCaptureTs) {
            this.statusText.textContent = "Laster…";
            this.statusEl.className = "status-pill warn";
            return;
        }
        // Compute server-corrected "now" if we have a delta, otherwise fall back to client now
        const delta = appState.getState('server.clockDeltaMs');
        const correctedNow = (delta != null) ? (Date.now() - Number(delta)) : Date.now();
        const ageSec = Math.floor((correctedNow - this.imageCaptureTs) / 1000);
        this.statusEl.className = "status-pill " + (ageSec > 300 ? "bad" : ageSec > 120 ? "warn" : "ok");
        this.statusText.textContent = `Bilde ${humanAge(correctedNow - this.imageCaptureTs)} gammelt`;
    }
}
