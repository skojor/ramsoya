// Image and status management
import { CONFIG } from './constants.js';
import { bust, humanAge } from './utils.js';

export class ImageManager {
    constructor() {
        this.lastImageTs = 0;
        this.lastWeatherTs = 0;
        this.imageCaptureTs = 0;
        this.camImg = document.getElementById("cam");
        this.statusEl = document.getElementById("status");
        this.statusText = document.getElementById("statusText");
    }

    refreshImage() {
        const img = new Image();
        img.onload = async () => {
            this.camImg.src = img.src;
            this.lastImageTs = Date.now();
            await this.updateImageCaptureTime();
            this.updateStatus();
        };
        img.onerror = () => {
        };
        img.src = bust(CONFIG.IMG_URL);
    }

    async updateImageCaptureTime() {
        try {
            const res = await fetch(CONFIG.ENDPOINTS.IMAGE_METADATA, {
                cache: 'no-cache',
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) {
                console.warn('Image metadata fetch failed:', res.status);
                return;
            }

            const data = await res.json();

            if (data.success && data.lastModified) {
                // Parse the Last-Modified header to get the capture timestamp
                this.imageCaptureTs = new Date(data.lastModified).getTime();
            } else {
                console.warn('Invalid image metadata response:', data);
            }
        } catch (e) {
            console.error('Error fetching image metadata:', e);
            // Don't update imageCaptureTs if we can't get the data
        }
    }

    updateStatus() {
        if (!this.imageCaptureTs) {
            this.statusText.textContent = "Laster…";
            this.statusEl.className = "status-pill warn";
            return;
        }
        const ageSec = Math.floor((Date.now() - this.imageCaptureTs) / 1000);
        this.statusEl.className = "status-pill " + (ageSec > CONFIG.STATUS.IMAGE_AGE_BAD_SEC ? "bad" : ageSec > CONFIG.STATUS.IMAGE_AGE_WARN_SEC ? "warn" : "ok");
        this.statusText.textContent = `Bilde ${humanAge(Date.now() - this.imageCaptureTs)} gammelt`;
    }
}
