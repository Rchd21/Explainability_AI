/**
 * ExportService.js
 * 
 * Service for exporting data to CSV and JSON formats.
 * Handles file generation and download.
 */

import { config } from '../core/Config.js';

class ExportService {
    
    /**
     * Export data to CSV format
     * @param {Array<Object>} data - Array of objects to export
     * @param {string} filename - Filename without extension
     * @param {Object} options - Export options
     */
    exportCsv(data, filename, options = {}) {
        if (!data || data.length === 0) {
            console.warn('[ExportService] No data to export');
            return;
        }
        
        const {
            columns = null,
            headers = null,
            delimiter = ','
        } = options;
        
        // Determine columns to export
        const keys = columns || Object.keys(data[0]);
        
        // Build header row
        const headerRow = keys.map(key => {
            const header = headers?.[key] || this._formatHeader(key);
            return this._escapeCSVValue(header);
        }).join(delimiter);
        
        // Build data rows
        const dataRows = data.map(item => {
            return keys.map(key => {
                const value = this._getNestedValue(item, key);
                return this._escapeCSVValue(this._formatValue(value));
            }).join(delimiter);
        });
        
        // Combine and create blob
        const csvContent = [headerRow, ...dataRows].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        this._downloadFile(blob, `${filename}.csv`);
    }
    
    /**
     * Export data to JSON format
     * @param {Array<Object>|Object} data - Data to export
     * @param {string} filename - Filename without extension
     * @param {Object} options - Export options
     */
    exportJson(data, filename, options = {}) {
        if (!data) {
            console.warn('[ExportService] No data to export');
            return;
        }
        
        const { pretty = true } = options;
        
        const jsonContent = pretty 
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data);
        
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        
        this._downloadFile(blob, `${filename}.json`);
    }
    
    /**
     * Format a key into a readable header
     * @param {string} key - Object key
     * @returns {string} Formatted header
     */
    _formatHeader(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    /**
     * Format a value for export
     * @param {*} value - Value to format
     * @returns {string} Formatted value
     */
    _formatValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (value instanceof Date) {
            return value.toISOString();
        }
        
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        
        return String(value);
    }
    
    /**
     * Escape a value for CSV
     * @param {string} value - Value to escape
     * @returns {string} Escaped value
     */
    _escapeCSVValue(value) {
        const stringValue = String(value);
        
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    }
    
    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Dot-notation path
     * @returns {*} Value at path
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }
    
    /**
     * Trigger file download
     * @param {Blob} blob - File blob
     * @param {string} filename - Filename with extension
     */
    _downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * Generate filename with timestamp
     * @param {string} prefix - Filename prefix
     * @returns {string} Filename with timestamp
     */
    generateFilename(prefix) {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
        return `${prefix}_${timestamp}`;
    }
}

export const exportService = new ExportService();
