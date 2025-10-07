// Moon phase management
import { CONFIG } from './constants.js';

export class MoonManager {
    constructor() {
        this.moonSvg = document.getElementById("moonSvg");
        this.moonText = document.getElementById("moonText");
    }

    async fetchMoon() {
        try {
            const res = await fetch(CONFIG.MOON_URL, { cache: "no-cache" });
            const data = await res.json();

            // Use pre-calculated values from enhanced backend proxy
            if (data.processed) {
                this.moonSvg.innerHTML = data.processed.svg;
                this.moonSvg.setAttribute("viewBox", "0 0 120 120");
                this.moonText.textContent = data.processed.text;
            } else {
                // Minimal fallback for unexpected response format
                this.moonText.textContent = "Kunne ikke behandle månedata";
                console.warn("Moon proxy returned unexpected format:", data);
            }
        } catch (err) {
            console.error("Moon API-feil:", err);
            this.moonText.textContent = "Kunne ikke hente månefasen nå.";
            // Simple fallback moon display
            this.moonSvg.innerHTML = '<circle cx="60" cy="60" r="60" fill="#1e2228"/><circle cx="60" cy="60" r="59.4" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>';
            this.moonSvg.setAttribute("viewBox", "0 0 120 120");
        }
    }
}
