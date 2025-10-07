// Image and status management
import { CONFIG } from './constants.js';
import { bust, humanAge } from './utils.js';
import { appState } from './state-manager.js';

export class ImageManager {
    constructor() {
        this.lastImageTs = 0;
        this.lastWeatherTs = 0;
        this.imageCaptureTs = 0;
        this.camImg = document.getElementById("cam");
        this.statusEl = document.getElementById("status");
        this.statusText = document.getElementById("statusText");

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions() {
        // Update UI when image status changes
        appState.subscribe('image.status', (status) => {
            this.updateStatusUI(status);
        });

        // Update UI when image capture time changes
        appState.subscribe('image.captureTime', (captureTime) => {
            this.imageCaptureTs = captureTime;
            this.updateStatus();
        });
    }

    refreshImage() {
        const img = new Image();
        img.onload = async () => {
            this.camImg.src = img.src;
            this.lastImageTs = Date.now();

            // Update state
            appState.setState('image.url', img.src);
            appState.setState('image.lastUpdate', this.lastImageTs);

            await this.updateImageCaptureTime();
            this.updateStatus();
        };
        img.onerror = () => {
            appState.setState('image.status', 'error');
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
                const captureTime = new Date(data.lastModified).getTime();
                // Update state instead of instance variable
                appState.setState('image.captureTime', captureTime);
            } else {
                console.warn('Invalid image metadata response:', data);
            }
        } catch (e) {
            console.error('Error fetching image metadata:', e);
            appState.setState('image.status', 'metadata-error');
        }
    }

    updateStatus() {
        const captureTime = appState.getState('image.captureTime');

        if (!captureTime) {
            appState.setState('image.status', 'loading');
            return;
        }

        const ageSec = Math.floor((Date.now() - captureTime) / 1000);
        let status = 'ok';

        if (ageSec > CONFIG.STATUS.IMAGE_AGE_BAD_SEC) {
            status = 'bad';
        } else if (ageSec > CONFIG.STATUS.IMAGE_AGE_WARN_SEC) {
            status = 'warn';
        }

        appState.setState('image.status', status);
    }

    updateStatusUI(status) {
        const captureTime = appState.getState('image.captureTime');

        if (status === 'loading') {
            this.statusText.textContent = "Laster…";
            this.statusEl.className = "status-pill warn";
        } else if (status === 'error' || status === 'metadata-error') {
            this.statusText.textContent = "Feil ved lasting";
            this.statusEl.className = "status-pill bad";
        } else if (captureTime) {
            this.statusEl.className = `status-pill ${status}`;
            this.statusText.textContent = `Bilde ${humanAge(Date.now() - captureTime)} gammelt`;
        }
    }
}
