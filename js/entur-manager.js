// Entur public transport data management
export class EnturManager {
    constructor() {
        this.apiUrl = 'entur_api.php';
        this.refreshMs = 60_000; // 1 minute

        this.iconPin = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;

        this.elements = {
            dep: () => document.getElementById("entur-next-dep"),
            updated: () => document.getElementById("entur-updated")
        };

        this.init();
    }

    init() {
        console.log('Initializing Entur integration...');
        this.updateEntur();
        setInterval(() => this.updateEntur(), this.refreshMs);
    }

    formatTime(isoString) {
        if (!isoString) return '—';
        const depTime = new Date(isoString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const depDate = new Date(depTime.getFullYear(), depTime.getMonth(), depTime.getDate());

        const timeStr = new Intl.DateTimeFormat('nb-NO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Oslo'
        }).format(depTime);

        if (depDate.getTime() === today.getTime()) {
            return timeStr;
        } else if (depDate.getTime() === tomorrow.getTime()) {
            return timeStr + ' <span class="badge-tomorrow">(i morgen)</span>';
        } else {
            const dayStr = new Intl.DateTimeFormat('nb-NO', {
                weekday: 'short',
                day: 'numeric',
                timeZone: 'Europe/Oslo'
            }).format(depTime);
            return timeStr + ' <span class="badge-tomorrow">(' + dayStr + ')</span>';
        }
    }

    renderBidirectionalDepartures(data) {
        console.log('Rendering Entur departures:', data);

        const {bidirectionalDepartures, stopRamsoyUrl, stopSandviksUrl} = data;

        if (!bidirectionalDepartures || bidirectionalDepartures.length === 0) {
            this.elements.dep().innerHTML = '<div>Ingen avganger funnet</div>';
            return;
        }

        let html = '';

        bidirectionalDepartures.forEach(item => {
            const dep = item.departure;
            const direction = item.direction;
            const isVerified = item.verified;
            const isFallback = item.isFallback || false;

            // Fix: Handle both "Ramsøy" and "Ramsy" (typo in API response)
            const isFromRamsoy = direction.includes('Ramsy →') || direction.includes('Ramsøy →');
            const stopUrl = isFromRamsoy ? stopRamsoyUrl : stopSandviksUrl;
            const actionBtn = `<a class="iconbtn" href="${stopUrl}" target="_blank" rel="noopener" title="Åpne i Entur – ${direction}">${this.iconPin}</a>`;

            // Format departure time
            const depTimeFormatted = this.formatTime(dep.time);

            // Format on-time status with enhanced logic
            let onTimeStatus = '';
            if (dep.onTimeStatus) {
                onTimeStatus = ` (${dep.onTimeStatus})`;
            }

            // Format arrival info with verification status
            let arrivalInfo = '';
            if (dep.arrivalTime && dep.arrivalTime !== dep.time) {
                const arrivalTimeFormatted = this.formatTime(dep.arrivalTime);
                // Extract destination from direction for arrival info
                const destination = direction.includes('Sandviksberget') ? 'Sandviksberget' : 'Ramsøy';
                arrivalInfo = ` • Ankomst ${destination} ${arrivalTimeFormatted}`;
            }

            // Add fallback note if this is unverified route data
            let fallbackNote = '';
            if (isFallback && !isVerified) {
                const tooltip = 'title="Entur mangler informasjon om mellomstopp, så anløpet kan ikke bekreftes."';
                fallbackNote = ` • <span ${tooltip}>anløp ikke bekreftet</span>`;
            }

            // Build the complete line with enhanced status information
            html += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.4rem 0px;">`;
            html += `<span><strong style="color:#a9b3bd;font-weight:600;margin-right:.3rem;">${direction}:</strong> ${depTimeFormatted} – ${dep.destination}${onTimeStatus}${arrivalInfo}${fallbackNote}</span>`;
            html += `<div class="row-actions">${actionBtn}</div>`;
            html += `</div>`;
        });

        console.log('Generated HTML:', html);
        this.elements.dep().innerHTML = html;
    }

    async updateEntur() {
        try {
            console.log('Starting Entur update...');
            this.elements.updated().textContent = "oppdaterer…";

            const url = `${this.apiUrl}?bidirectional=true&_=${Date.now()}`;
            console.log('Fetching Entur data from:', url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Entur API response:', result);

            if (result.success) {
                this.renderBidirectionalDepartures(result.data);
                this.elements.updated().textContent = `oppdatert ${result.updated}`;
                console.log('Entur update successful');
            } else {
                throw new Error(result.error || 'Ukjent feil fra API');
            }
        } catch (error) {
            console.error('Entur frontend error:', error);
            this.elements.dep().innerHTML = '<div style="color: #ffb3b3;">Kunne ikke hente avganger: ' + error.message + '</div>';
            this.elements.updated().textContent = "feil ved oppdatering";
        }
    }
}
