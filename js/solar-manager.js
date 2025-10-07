// Solar events management
class SolarManager {
    constructor() {
        this.nextSunEventEl = document.getElementById("nextSunEvent");
    }

    formatAllSolarEvents(data) {
        // Check if we have any solar event data
        if (!data || !data.events || !Array.isArray(data.events) || data.events.length === 0) {
            return '<div class="sun-error">Ingen soldata tilgjengelig</div>';
        }

        // Display all upcoming events
        let html = '';

        data.events.forEach((event, index) => {
            const eventTime = new Date(event.iso);
            const timeStr = eventTime.toLocaleTimeString('no-NO', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: CONFIG.TZ_OSLO
            });

            // Add some spacing between events
            if (index > 0) {
                html += '<div class="sun-separator"></div>';
            }

            html += `
                <div class="sun-event">
                    <img src="ikoner/${event.icon}" alt="${event.label}" class="sun-icon">
                    <div class="sun-info">
                        <div class="sun-label">${event.label} ${event.dayLabel.toLowerCase()}</div>
                        <div class="sun-time">${timeStr}</div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    async loadSunriseSunset() {
        try {
            const res = await fetch(CONFIG.SUNRISE_URL, { cache: 'no-cache' });
            const data = await res.json();

            if (!res.ok) {
                console.error('Sunrise HTTP', res.status, data);
                this.nextSunEventEl.innerHTML = '<div class="sun-error">Kunne ikke hente soldata</div>';
                return;
            }

            this.nextSunEventEl.innerHTML = this.formatAllSolarEvents(data);
        } catch (e) {
            console.error('Sunrise error', e);
            this.nextSunEventEl.innerHTML = '<div class="sun-error">Kunne ikke hente soldata</div>';
        }
    }
}
