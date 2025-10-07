// Reusable UI components for consistent DOM manipulation
export class UIComponents {

    /**
     * Create a status indicator component
     * @param {string} text - Status text
     * @param {string} type - Status type: 'loading', 'success', 'error', 'warning'
     * @returns {HTMLElement}
     */
    static createStatusIndicator(text, type = 'success') {
        const element = document.createElement('div');
        element.className = `status-indicator status-${type}`;
        element.textContent = text;
        return element;
    }

    /**
     * Create a data card component
     * @param {Object} config - Card configuration
     * @param {string} config.title - Card title
     * @param {Array|string} config.content - Card content (array of lines or string)
     * @param {string} config.className - Additional CSS class
     * @returns {HTMLElement}
     */
    static createCard(config) {
        const { title, content, className = '' } = config;
        const card = document.createElement('div');
        card.className = `data-card ${className}`;

        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'card-title';
            titleEl.textContent = title;
            card.appendChild(titleEl);
        }

        const contentEl = document.createElement('div');
        contentEl.className = 'card-content';

        if (Array.isArray(content)) {
            const list = document.createElement('ul');
            content.forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = String(item);
                list.appendChild(listItem);
            });
            contentEl.appendChild(list);
        } else if (content) {
            contentEl.textContent = String(content);
        }

        card.appendChild(contentEl);
        return card;
    }

    /**
     * Create a data table component
     * @param {Object} config - Table configuration
     * @param {Array} config.headers - Table headers
     * @param {Array} config.rows - Table rows data
     * @param {Function} config.onRowClick - Row click handler
     * @param {string} config.emptyMessage - Message when no data
     * @returns {HTMLElement}
     */
    static createTable(config) {
        const { headers, rows, onRowClick, emptyMessage = 'Ingen data' } = config;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';

        if (!rows || rows.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'table-empty';
            emptyEl.textContent = emptyMessage;
            wrapper.appendChild(emptyEl);
            return wrapper;
        }

        const table = document.createElement('table');
        table.className = 'data-table';

        // Create header
        if (headers && headers.length > 0) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
        }

        // Create body
        const tbody = document.createElement('tbody');
        rows.forEach(rowData => {
            const row = document.createElement('tr');

            if (onRowClick) {
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => onRowClick(rowData));
            }

            if (Array.isArray(rowData)) {
                rowData.forEach(cellData => {
                    const td = document.createElement('td');
                    if (typeof cellData === 'string' && cellData.includes('<')) {
                        td.innerHTML = cellData; // For HTML content like SVGs
                    } else {
                        td.textContent = String(cellData);
                    }
                    row.appendChild(td);
                });
            } else if (rowData && typeof rowData === 'object') {
                // Handle object-based row data
                Object.values(rowData).forEach(cellData => {
                    const td = document.createElement('td');
                    if (typeof cellData === 'string' && cellData.includes('<')) {
                        td.innerHTML = cellData;
                    } else {
                        td.textContent = String(cellData);
                    }
                    row.appendChild(td);
                });
            }

            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        wrapper.appendChild(table);

        return wrapper;
    }

    /**
     * Create a loading spinner component
     * @param {string} message - Loading message
     * @returns {HTMLElement}
     */
    static createLoader(message = 'Laster...') {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <div class="loader-text">${message}</div>
        `;
        return loader;
    }

    /**
     * Create an error display component
     * @param {string} message - Error message
     * @param {Function} onRetry - Retry callback (optional)
     * @returns {HTMLElement}
     */
    static createError(message, onRetry = null) {
        const error = document.createElement('div');
        error.className = 'error-display';

        const messageEl = document.createElement('div');
        messageEl.className = 'error-message';
        messageEl.textContent = message;
        error.appendChild(messageEl);

        if (onRetry) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'retry-button';
            retryBtn.textContent = 'Prøv igjen';
            retryBtn.addEventListener('click', onRetry);
            error.appendChild(retryBtn);
        }

        return error;
    }

    /**
     * Create a forecast card component (specialized)
     * @param {Object} data - Forecast data
     * @returns {HTMLElement}
     */
    static createForecastCard(data) {
        const { timeLabel, tDisp, pDisp, windTxt, arrow, iconPath, sym } = data;
        const card = document.createElement('div');
        card.className = 'fcH-card';

        card.innerHTML = `
            <div class="fcH-time">${timeLabel}</div>
            <div class="fcH-icon">
                ${iconPath ? `<img src="${iconPath}" alt="${sym}" onerror="this.onerror=null;this.src='ikoner/yr/04.svg';this.alt='cloudy';">` : '—'}
            </div>
            <div class="fcH-t">${tDisp}</div>
            <div class="fcH-mm">${pDisp}</div>
            <div class="fcH-wind">${windTxt} ${arrow}</div>
        `;

        return card;
    }

    /**
     * Update element content safely
     * @param {HTMLElement|string} element - DOM element or selector
     * @param {string|HTMLElement} content - New content
     */
    static updateContent(element, content) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (!el) return;

        if (typeof content === 'string') {
            el.textContent = content;
        } else if (content instanceof HTMLElement) {
            el.innerHTML = '';
            el.appendChild(content);
        }
    }

    /**
     * Show/hide element with optional fade effect
     * @param {HTMLElement|string} element - DOM element or selector
     * @param {boolean} show - Whether to show or hide
     * @param {boolean} fade - Whether to use fade effect
     */
    static toggleElement(element, show, fade = false) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (!el) return;

        if (fade) {
            if (show) {
                el.style.opacity = '0';
                el.hidden = false;
                el.style.transition = 'opacity 0.3s ease';
                setTimeout(() => el.style.opacity = '1', 10);
            } else {
                el.style.transition = 'opacity 0.3s ease';
                el.style.opacity = '0';
                setTimeout(() => el.hidden = true, 300);
            }
        } else {
            el.hidden = !show;
        }
    }

    /**
     * Clear container and add new content
     * @param {HTMLElement|string} container - Container element or selector
     * @param {HTMLElement|Array<HTMLElement>} content - New content
     */
    static replaceContent(container, content) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        el.innerHTML = '';

        if (Array.isArray(content)) {
            content.forEach(item => el.appendChild(item));
        } else if (content instanceof HTMLElement) {
            el.appendChild(content);
        }
    }
}

// Add basic CSS for components if not already present
export const injectComponentStyles = () => {
    if (document.getElementById('ui-components-styles')) return;

    const style = document.createElement('style');
    style.id = 'ui-components-styles';
    style.textContent = `
        .status-indicator {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-loading { background: #e3f2fd; color: #1976d2; }
        .status-success { background: #e8f5e8; color: #2e7d32; }
        .status-error { background: #ffebee; color: #c62828; }
        .status-warning { background: #fff3e0; color: #f57c00; }

        .data-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            margin: 8px 0;
        }
        .card-title {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 600;
        }
        .card-content ul {
            margin: 0;
            padding-left: 16px;
        }

        .table-wrapper {
            overflow-x: auto;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        .data-table th,
        .data-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .data-table th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
        }
        .table-empty {
            text-align: center;
            padding: 24px;
            color: rgba(255, 255, 255, 0.6);
        }

        .loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 24px;
        }
        .loader-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        .loader-text {
            margin-top: 12px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .error-display {
            text-align: center;
            padding: 24px;
            color: #ffcdd2;
        }
        .error-message {
            margin-bottom: 12px;
        }
        .retry-button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .retry-button:hover {
            background: rgba(255, 255, 255, 0.2);
        }
    `;
    document.head.appendChild(style);
};
