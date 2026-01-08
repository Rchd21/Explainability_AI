/**
 * Chart.js
 * 
 * Wrapper component for Chart.js library.
 * Provides consistent styling and easy data updates.
 */

import { config } from '../core/index.js';

class ChartWrapper {
    /**
     * Create a ChartWrapper instance
     * @param {string} canvasId - Canvas element ID
     * @param {string} type - Chart type ('line', 'bar', 'pie', 'doughnut')
     * @param {Object} options - Chart options
     */
    constructor(canvasId, type, options = {}) {
        this._canvas = document.getElementById(canvasId);
        this._chart = null;
        this._type = type;
        this._options = options;
    }
    
    /**
     * Initialize or update chart with data
     * @param {Array} labels - Chart labels
     * @param {Array} datasets - Chart datasets
     */
    setData(labels, datasets) {
        if (!this._canvas) return;
        
        const chartConfig = this._buildConfig(labels, datasets);
        
        if (this._chart) {
            this._chart.data = chartConfig.data;
            this._chart.update();
        } else {
            this._chart = new Chart(this._canvas, chartConfig);
        }
    }
    
    /**
     * Build Chart.js configuration
     * @param {Array} labels - Chart labels
     * @param {Array} datasets - Chart datasets
     * @returns {Object} Chart configuration
     */
    _buildConfig(labels, datasets) {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: this._options.showLegend !== false,
                    position: this._options.legendPosition || 'top',
                    labels: {
                        color: isDark ? '#a0a0b0' : '#4b5563',
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 12
                        },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#22222f' : '#ffffff',
                    titleColor: isDark ? '#f0f0f5' : '#111827',
                    bodyColor: isDark ? '#a0a0b0' : '#4b5563',
                    borderColor: isDark ? '#2a2a3a' : '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        family: "'Outfit', sans-serif",
                        size: 13,
                        weight: 600
                    },
                    bodyFont: {
                        family: "'Outfit', sans-serif",
                        size: 12
                    },
                    displayColors: true,
                    boxPadding: 4
                }
            },
            scales: this._getScales(isDark)
        };
        
        // Merge with custom options
        const mergedOptions = this._mergeDeep(baseOptions, this._options.chartOptions || {});
        
        return {
            type: this._type,
            data: {
                labels,
                datasets: datasets.map(ds => this._processDataset(ds, isDark))
            },
            options: mergedOptions
        };
    }
    
    /**
     * Get scale configurations based on chart type
     * @param {boolean} isDark - Dark mode flag
     * @returns {Object} Scales configuration
     */
    _getScales(isDark) {
        if (this._type === 'pie' || this._type === 'doughnut') {
            return {};
        }
        
        const scaleConfig = {
            grid: {
                color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
            },
            ticks: {
                color: isDark ? '#707080' : '#6b7280',
                font: {
                    family: "'JetBrains Mono', monospace",
                    size: 11
                },
                padding: 8
            },
            border: {
                display: false
            }
        };
        
        return {
            x: {
                ...scaleConfig,
                grid: {
                    display: false
                }
            },
            y: {
                ...scaleConfig,
                beginAtZero: true
            }
        };
    }
    
    /**
     * Process dataset with default styling
     * @param {Object} dataset - Dataset configuration
     * @param {boolean} isDark - Dark mode flag
     * @returns {Object} Processed dataset
     */
    _processDataset(dataset, isDark) {
        const defaults = {
            line: {
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 2
            },
            bar: {
                borderWidth: 0,
                borderRadius: 4,
                borderSkipped: false
            },
            pie: {
                borderWidth: 2,
                borderColor: isDark ? '#12121a' : '#ffffff'
            },
            doughnut: {
                borderWidth: 2,
                borderColor: isDark ? '#12121a' : '#ffffff',
                cutout: '70%'
            }
        };
        
        return {
            ...defaults[this._type],
            ...dataset
        };
    }
    
    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    _mergeDeep(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                result[key] = this._mergeDeep(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    /**
     * Update chart options
     * @param {Object} options - New options
     */
    updateOptions(options) {
        if (this._chart) {
            Object.assign(this._chart.options, options);
            this._chart.update();
        }
    }
    
    /**
     * Refresh chart (e.g., after theme change)
     */
    refresh() {
        if (this._chart) {
            const labels = this._chart.data.labels;
            const datasets = this._chart.data.datasets;
            this.destroy();
            this.setData(labels, datasets);
        }
    }
    
    /**
     * Destroy the chart instance
     */
    destroy() {
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
    }
    
    /**
     * Get chart instance
     * @returns {Chart} Chart.js instance
     */
    getChart() {
        return this._chart;
    }
}

// ============================================================================
// Pre-configured Chart Factories
// ============================================================================

/**
 * Create an activity line chart
 * @param {string} canvasId - Canvas ID
 * @returns {ChartWrapper} Chart wrapper instance
 */
export function createActivityChart(canvasId) {
    return new ChartWrapper(canvasId, 'line', {
        showLegend: true,
        legendPosition: 'top'
    });
}

/**
 * Create a rating distribution bar chart
 * @param {string} canvasId - Canvas ID
 * @returns {ChartWrapper} Chart wrapper instance
 */
export function createRatingChart(canvasId) {
    return new ChartWrapper(canvasId, 'bar', {
        showLegend: false,
        chartOptions: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Create an hourly distribution bar chart
 * @param {string} canvasId - Canvas ID
 * @returns {ChartWrapper} Chart wrapper instance
 */
export function createHourlyChart(canvasId) {
    return new ChartWrapper(canvasId, 'bar', {
        showLegend: false
    });
}

/**
 * Create a horizontal bar chart for top queries
 * @param {string} canvasId - Canvas ID
 * @returns {ChartWrapper} Chart wrapper instance
 */
export function createQueriesChart(canvasId) {
    return new ChartWrapper(canvasId, 'bar', {
        showLegend: false,
        chartOptions: {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Create a doughnut chart
 * @param {string} canvasId - Canvas ID
 * @returns {ChartWrapper} Chart wrapper instance
 */
export function createDoughnutChart(canvasId) {
    return new ChartWrapper(canvasId, 'doughnut', {
        showLegend: true,
        legendPosition: 'right'
    });
}

export { ChartWrapper };
