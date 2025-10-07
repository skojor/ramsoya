// Image and status management
class ImageManager {
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
            // Implementation here
        } catch (e) {
            // Error handling
        }
    }

    updateStatus() {
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
