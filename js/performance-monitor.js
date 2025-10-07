// Performance monitoring and debugging interface for real-time applications
// Provides insights into visibility-aware optimizations and request patterns

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: new Map(), // Track request counts per endpoint
            intervals: new Map(), // Track interval adjustments
            bandwidth: { total: 0, saved: 0 }, // Bandwidth usage tracking
            errors: new Map(), // Error tracking per endpoint
            lastUpdate: Date.now()
        };

        this.isDebugMode = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.search.includes('debug=true');

        if (this.isDebugMode) {
            this.setupDebugInterface();
            console.log('🔍 Performance Monitor initialized in debug mode');
        }
    }

    /**
     * Record a successful API request
     */
    recordRequest(endpoint, responseSize = 0, fromCache = false) {
        const key = this.normalizeEndpoint(endpoint);
        const current = this.metrics.requests.get(key) || {
            count: 0,
            cached: 0,
            totalSize: 0,
            errors: 0,
            lastRequest: null
        };

        current.count++;
        current.totalSize += responseSize;
        current.lastRequest = Date.now();

        if (fromCache) {
            current.cached++;
            this.metrics.bandwidth.saved += responseSize;
        } else {
            this.metrics.bandwidth.total += responseSize;
        }

        this.metrics.requests.set(key, current);
    }

    /**
     * Record a failed API request
     */
    recordError(endpoint, error) {
        const key = this.normalizeEndpoint(endpoint);
        const current = this.metrics.requests.get(key) || {
            count: 0,
            cached: 0,
            totalSize: 0,
            errors: 0,
            lastRequest: null
        };

        current.errors++;
        this.metrics.requests.set(key, current);

        // Track error types
        const errorKey = `${key}::${error.name || 'UnknownError'}`;
        this.metrics.errors.set(errorKey, (this.metrics.errors.get(errorKey) || 0) + 1);

        if (this.isDebugMode) {
            console.warn(`📊 API Error recorded: ${endpoint}`, error);
        }
    }

    /**
     * Record interval adjustment due to visibility change
     */
    recordIntervalAdjustment(intervalKey, oldInterval, newInterval, isVisible) {
        const adjustment = {
            timestamp: Date.now(),
            oldInterval,
            newInterval,
            isVisible,
            savings: oldInterval - newInterval
        };

        const history = this.metrics.intervals.get(intervalKey) || [];
        history.push(adjustment);

        // Keep only last 50 adjustments per interval
        if (history.length > 50) {
            history.shift();
        }

        this.metrics.intervals.set(intervalKey, history);

        if (this.isDebugMode) {
            console.log(`⏱️ Interval adjusted: ${intervalKey} ${oldInterval}ms → ${newInterval}ms (${isVisible ? 'visible' : 'hidden'})`);
        }
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const now = Date.now();
        const uptime = now - this.metrics.lastUpdate;

        const totalRequests = Array.from(this.metrics.requests.values())
            .reduce((sum, stats) => sum + stats.count, 0);

        const totalErrors = Array.from(this.metrics.requests.values())
            .reduce((sum, stats) => sum + stats.errors, 0);

        const totalBandwidth = this.metrics.bandwidth.total;
        const savedBandwidth = this.metrics.bandwidth.saved;

        return {
            uptime,
            requests: {
                total: totalRequests,
                errors: totalErrors,
                errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(1) : '0.0'
            },
            bandwidth: {
                total: this.formatBytes(totalBandwidth),
                saved: this.formatBytes(savedBandwidth),
                efficiency: totalBandwidth > 0 ? ((savedBandwidth / totalBandwidth) * 100).toFixed(1) : '0.0'
            },
            intervals: this.getIntervalStats()
        };
    }

    /**
     * Get detailed interval statistics
     */
    getIntervalStats() {
        const stats = {};

        for (const [key, history] of this.metrics.intervals) {
            const recent = history.slice(-10); // Last 10 adjustments
            const totalSavings = recent.reduce((sum, adj) => sum + Math.max(0, adj.savings), 0);
            const visibilityChanges = recent.filter(adj => adj.isVisible !== undefined).length;

            stats[key] = {
                adjustments: history.length,
                recentSavings: totalSavings,
                visibilityChanges
            };
        }

        return stats;
    }

    /**
     * Setup debug interface for development
     */
    setupDebugInterface() {
        // Add to global scope for console access
        window.perfMonitor = this;

        // Log summary every 60 seconds in debug mode
        setInterval(() => {
            const summary = this.getSummary();
            console.group('📊 Performance Summary');
            console.log('Uptime:', this.formatDuration(summary.uptime));
            console.log('Requests:', `${summary.requests.total} total, ${summary.requests.errors} errors (${summary.requests.errorRate}%)`);
            console.log('Bandwidth:', `${summary.bandwidth.total} used, ${summary.bandwidth.saved} saved (${summary.bandwidth.efficiency}% efficiency)`);
            console.log('Intervals:', Object.keys(summary.intervals).length, 'tracked');
            console.groupEnd();
        }, 60000);

        // Add keyboard shortcut to show detailed stats (Ctrl+Shift+P)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
                this.showDetailedStats();
            }
        });
    }

    /**
     * Show detailed performance statistics
     */
    showDetailedStats() {
        const summary = this.getSummary();

        console.group('🔍 Detailed Performance Stats');

        // Request breakdown
        console.group('📡 API Requests');
        for (const [endpoint, stats] of this.metrics.requests) {
            console.log(`${endpoint}:`, {
                requests: stats.count,
                errors: stats.errors,
                cached: stats.cached,
                avgSize: stats.count > 0 ? this.formatBytes(stats.totalSize / stats.count) : '0B',
                lastRequest: stats.lastRequest ? new Date(stats.lastRequest).toLocaleTimeString() : 'Never'
            });
        }
        console.groupEnd();

        // Interval adjustments
        console.group('⏱️ Interval Adjustments');
        for (const [key, history] of this.metrics.intervals) {
            const recent = history.slice(-5);
            console.log(`${key}:`, {
                totalAdjustments: history.length,
                recentChanges: recent.map(adj => ({
                    time: new Date(adj.timestamp).toLocaleTimeString(),
                    change: `${adj.oldInterval}ms → ${adj.newInterval}ms`,
                    visible: adj.isVisible
                }))
            });
        }
        console.groupEnd();

        // Error breakdown
        if (this.metrics.errors.size > 0) {
            console.group('❌ Error Breakdown');
            for (const [errorKey, count] of this.metrics.errors) {
                console.log(errorKey, 'occurred', count, 'times');
            }
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Normalize endpoint names for consistent tracking
     */
    normalizeEndpoint(endpoint) {
        // Remove query parameters and normalize paths
        try {
            const url = new URL(endpoint, window.location.href);
            return url.pathname.replace(/^\/+/, '') || url.hostname;
        } catch {
            // If URL parsing fails, use the endpoint as-is but clean it up
            return endpoint.split('?')[0].replace(/^\/+/, '') || endpoint;
        }
    }

    /**
     * Format bytes in human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.requests.clear();
        this.metrics.intervals.clear();
        this.metrics.errors.clear();
        this.metrics.bandwidth = { total: 0, saved: 0 };
        this.metrics.lastUpdate = Date.now();

        console.log('📊 Performance metrics reset');
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();
