// Image management and overlay functionality
import { CONFIG } from './constants.js';
import { bust } from './utils.js';
import { appState } from './state-manager.js';
import { apiClient } from './api-client.js';
import { visibilityManager } from './visibility-manager.js';

export class ImageManager {
    constructor() {
        this.imageEl = document.getElementById("cam"); // Fixed: changed from "image" to "cam" to match HTML
        this.refreshMs = CONFIG.INTERVALS.IMAGE_REFRESH;

        this.setupStateSubscriptions();
        this.init();
    }

    setupStateSubscriptions() {
        // Update image when state changes
        appState.subscribe('image.url', (imageUrl) => {
            if (imageUrl) {
                this.updateImage(imageUrl);
            }
        });

        // Handle loading state
        appState.subscribe('ui.loading', (loadingStates) => {
            if (loadingStates.image !== undefined) {
                this.updateLoadingState(loadingStates.image);
            }
        });

        // Handle image status
        appState.subscribe('image.status', (status) => {
            this.updateImageStatus(status);
        });

        // Update status text with image timing information
        appState.subscribe('image.captureTime', (captureTime) => {
            this.updateStatusText(captureTime);
        });

        // Also update status text when metadata changes
        appState.subscribe('image.metadata', (metadata) => {
            if (metadata && metadata.captureTime) {
                this.updateStatusText(metadata.captureTime);
            }
        });
    }

    updateLoadingState(isLoading) {
        if (isLoading) {
            appState.setState('image.status', 'loading');
            this.updateStatusTextRaw('Laster…');
        }
    }

    updateImageStatus(status) {
        // Visual feedback based on status could be added here
        console.log(`Image status: ${status}`);
    }

    updateStatusText(captureTime) {
        if (!captureTime) {
            this.updateStatusTextRaw('Ukjent tid');
            return;
        }

        const captureDate = new Date(captureTime);
        const now = new Date();
        const diffMs = now - captureDate;
        const diffSeconds = Math.floor(diffMs / 1000);

        let timeText;
        if (diffSeconds < 60) {
            timeText = `${diffSeconds} sek siden`;
        } else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            timeText = `${minutes} min siden`;
        } else {
            const hours = Math.floor(diffSeconds / 3600);
            timeText = `${hours} timer siden`;
        }

        this.updateStatusTextRaw(timeText);
    }

    updateStatusTextRaw(text) {
        const statusTextEl = document.getElementById('statusText');
        if (statusTextEl) {
            statusTextEl.textContent = text;
        }
    }

    init() {
        // Initial loads
        this.fetchImage();
        this.fetchImageMetadata();

        // Setup visibility-aware interval for image updates
        visibilityManager.setInterval('image',
            () => this.fetchImage(),
            this.refreshMs,
            5 // 5x slower when hidden (20s -> 100s) - most bandwidth intensive
        );

        // Setup separate interval for image metadata (less frequent)
        visibilityManager.setInterval('image-metadata',
            () => this.fetchImageMetadata(),
            CONFIG.INTERVALS.IMAGE_STATUS, // 1 second normally
            3 // 3x slower when hidden (1s -> 3s)
        );
    }

    updateImage(imageUrl) {
        if (this.imageEl) {
            this.imageEl.src = imageUrl;
            this.imageEl.onload = () => {
                appState.setState('image.status', 'loaded');
            };
            this.imageEl.onerror = () => {
                appState.setState('image.status', 'error');
                console.warn('Failed to load image:', imageUrl);
            };
        }
    }

    async fetchImage() {
        try {
            appState.setState('image.status', 'loading');

            // For image URLs, we don't need to parse JSON - just validate the URL is accessible
            const response = await fetch(bust(CONFIG.IMAGE_URL), {
                method: 'HEAD', // Just check if image exists
                cache: 'no-cache'
            });

            if (response.ok) {
                const imageUrl = bust(CONFIG.IMAGE_URL);
                appState.setState('image.url', imageUrl);
                appState.setState('image.lastUpdate', Date.now());
            } else {
                throw new Error(`HTTP ${response.status}: Image not available`);
            }

        } catch (error) {
            console.error("Image fetch error:", error);
            appState.setState('image.status', 'error');
            appState.setState('image.url', null);
        }
    }

    async fetchImageMetadata() {
        try {
            const metadata = await apiClient.get(CONFIG.ENDPOINTS.IMAGE_METADATA, 'image-metadata');

            if (metadata) {
                appState.setState('image.metadata', metadata);
                appState.setState('image.captureTime', metadata.captureTime || null);
            }

        } catch (error) {
            console.error("Image metadata fetch error:", error);
            appState.setState('image.metadata', null);
        }
    }
}
