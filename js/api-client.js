// Unified API client with interceptors, retries, and loading state management
import { appState } from './state-manager.js';

export class ApiClient {
    constructor() {
        this.defaultOptions = {
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        };
        this.retryConfig = {
            maxRetries: 2,
            retryDelay: 1000, // 1 second
            retryOn: [408, 429, 500, 502, 503, 504]
        };
        // Request deduplication map
        this.pendingRequests = new Map();
    }

    /**
     * Main fetch method with automatic retries and error handling
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @param {string} loadingKey - State key for loading indicator (optional)
     * @returns {Promise<any>} Parsed response data
     */
    async fetch(url, options = {}, loadingKey = null) {
        const requestKey = this.getRequestKey(url, options);

        // Return existing pending request if available
        if (this.pendingRequests.has(requestKey)) {
            console.log(`🔄 Deduplicating request to ${url}`);
            return this.pendingRequests.get(requestKey);
        }

        const mergedOptions = { ...this.defaultOptions, ...options };
        let lastError = null;

        // Create and store the promise
        const fetchPromise = this.executeFetch(url, mergedOptions, loadingKey);
        this.pendingRequests.set(requestKey, fetchPromise);

        try {
            const result = await fetchPromise;
            return result;
        } finally {
            // Clean up the pending request
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * Generate a unique key for request deduplication
     */
    getRequestKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `${method}:${url}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
    }

    /**
     * Execute the actual fetch with retries
     */
    async executeFetch(url, mergedOptions, loadingKey) {
        let lastError = null;

        // Set loading state
        if (loadingKey) {
            this.setLoadingState(loadingKey, true);
        }

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const response = await this.performRequest(url, mergedOptions);

                // Clear loading state on success
                if (loadingKey) {
                    this.setLoadingState(loadingKey, false);
                }

                return response;
            } catch (error) {
                lastError = error;

                // Don't retry on non-retryable errors
                if (!this.shouldRetry(error, attempt)) {
                    break;
                }

                // Wait before retrying
                if (attempt < this.retryConfig.maxRetries) {
                    await this.delay(this.retryConfig.retryDelay * (attempt + 1));
                }
            }
        }

        // Clear loading state on error
        if (loadingKey) {
            this.setLoadingState(loadingKey, false);
        }

        throw lastError;
    }

    /**
     * Perform the actual HTTP request with response validation
     */
    async performRequest(url, options) {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, response.status, url);
        }

        const text = await response.text();

        // Handle empty responses gracefully
        if (!text || text.trim().length === 0) {
            console.warn(`Empty response from ${url}`);
            return null;
        }

        // Try to parse JSON, fall back to text
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.warn(`Invalid JSON from ${url}:`, parseError.message);
            return text; // Return as text if JSON parsing fails
        }
    }

    /**
     * Determine if request should be retried
     */
    shouldRetry(error, attempt) {
        if (attempt >= this.retryConfig.maxRetries) {
            return false;
        }

        // Don't retry JSON parsing errors
        if (error.message?.includes('JSON') || error.message?.includes('parse')) {
            return false;
        }

        // Retry on network errors or specific HTTP status codes
        if (error instanceof ApiError) {
            return this.retryConfig.retryOn.includes(error.status);
        }

        // Retry on network errors (TypeError for fetch failures)
        return error instanceof TypeError;
    }

    /**
     * Set loading state in app state
     */
    setLoadingState(key, isLoading) {
        const loadingStates = appState.getState('ui.loading') || {};
        loadingStates[key] = isLoading;
        appState.setState('ui.loading', loadingStates);
    }

    /**
     * Utility method for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Convenience method for GET requests
     */
    async get(url, loadingKey = null) {
        return this.fetch(url, { method: 'GET' }, loadingKey);
    }

    /**
     * Convenience method for POST requests
     */
    async post(url, data, loadingKey = null) {
        return this.fetch(url, {
            method: 'POST',
            headers: {
                ...this.defaultOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }, loadingKey);
    }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(message, status, url) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
    }
}

// Create singleton instance
export const apiClient = new ApiClient();
