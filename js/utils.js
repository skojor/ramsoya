// Utility functions
export const norm360 = d => ((d % 360) + 360) % 360;

export function bust(url) {
    const u = new URL(url, location.href);
    u.searchParams.set("_", Date.now());
    return u.toString();
}

export function humanAge(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return `${m}m ${r}s`;
    const h = Math.floor(m / 60), mr = m % 60;
    return `${h}t ${mr}m`;
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

export const dayFmt = new Intl.DateTimeFormat('nb-NO', {
    weekday: 'short',
    day: '2-digit',
    timeZone: CONFIG.TZ_OSLO
});
