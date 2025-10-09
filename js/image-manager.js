// Image management and overlay functionality
import { CONFIG } from './constants.js';
import { bust, humanAge } from './utils.js';
import { visibilityManager } from './visibility-manager.js';
import { apiClient } from './api-client.js';

export class ImageManager {
    constructor() {
        this.imageEl = document.getElementById("cam");
        this.statusEl = document.getElementById("status");
        this.statusText = document.getElementById("statusText");
        this.refreshMs = CONFIG.INTERVALS.IMAGE_REFRESH;
        this.imageCaptureTs = 0;

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
        const ageSec = Math.floor((Date.now() - this.imageCaptureTs) / 1000);
        this.statusEl.className = "status-pill " + (ageSec > 300 ? "bad" : ageSec > 120 ? "warn" : "ok");
        this.statusText.textContent = `Bilde ${humanAge(Date.now() - this.imageCaptureTs)} gammelt`;
    }
}
