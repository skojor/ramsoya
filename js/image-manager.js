// Image management and overlay functionality
import { CONFIG } from './constants.js';
import { bust } from './utils.js';
import { visibilityManager } from './visibility-manager.js';

export class ImageManager {
    constructor() {
        this.imageEl = document.getElementById("cam");
        this.statusEl = document.getElementById("status");
        this.statusText = document.getElementById("statusText");
        this.refreshMs = CONFIG.INTERVALS.IMAGE_REFRESH;
        this.lastImageTs = 0;
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
            this.lastImageTs = Date.now();
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
            const res = await fetch('/image_metadata_proxy.php', {
                method: 'GET',
                cache: 'no-cache'
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.lastModified) {
                    const t = new Date(data.lastModified).getTime();
                    if (Number.isFinite(t)) {
                        this.imageCaptureTs = t;
                    }
                }
            }
        } catch (e) {
            console.error("Could not fetch image metadata:", e);
        }
    }

    humanAge(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60), r = s % 60;
        if (m < 60) return `${m}m ${r}s`;
        const h = Math.floor(m / 60), mr = m % 60;
        return `${h}t ${mr}m`;
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
        this.statusText.textContent = `Bilde ${this.humanAge(Date.now() - this.imageCaptureTs)} gammelt`;
    }
}
