// Utility functions
export const norm360 = d => ((d % 360) + 360) % 360;

export function bust(url) {
    const u = new URL(url, location.href);
    u.searchParams.set("_", Date.now());
    return u.toString();
}

export function humanAge(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));

    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalMinutes < 60) {
        return `${totalMinutes}m ${seconds}s`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}t ${minutes}m`;
}

// Import CONFIG for formatters
import { CONFIG } from './constants.js';

// Formatters
export const hourFmt = new Intl.DateTimeFormat('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CONFIG.TZ_OSLO,
    hour12: false
});
