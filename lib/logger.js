const chalk = require('chalk');
const moment = require('moment');

// Konfigurasi warna
const COLORS = {
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    success: 'green',
    debug: 'magenta',
    verbose: 'cyan',
    timestamp: 'gray'
};

class ThonLogger {
    constructor(options = {}) {
        this.showTimestamp = options.showTimestamp !== false;
        this.logLevel = options.logLevel || 'info'; // error > warn > info > debug > verbose
    }

    // Format pesan dengan timestamp
    _format(message, type) {
        const timestamp = this.showTimestamp 
            ? chalk[COLORS.timestamp](`[${moment().format('HH:mm:ss.SSS')}] `) 
            : '';
        const prefix = type ? chalk[COLORS[type]](`[${type.toUpperCase()}] `) : '';
        return `${timestamp}${prefix}${message}`;
    }

    // Method utama
    log(message, type = 'info') {
        if (this._shouldLog(type)) {
            console.log(this._format(message, type));
        }
    }

    // Method khusus
    error(message) { this.log(message, 'error'); }
    warn(message)  { this.log(message, 'warn'); }
    info(message)  { this.log(message, 'info'); }
    success(message) { this.log(message, 'success'); }
    debug(message) { this.log(message, 'debug'); }
    verbose(message) { this.log(message, 'verbose'); }

    // Cek level log
    _shouldLog(type) {
        const levels = ['error', 'warn', 'info', 'debug', 'verbose'];
        return levels.indexOf(type) <= levels.indexOf(this.logLevel);
    }

    // Fungsi utilitas warna
    static color(text, colorName) {
        return chalk[colorName]?.(text) || text;
    }

    static bgColor(text, bgColorName) {
        return chalk[bgColorName]?.(text) || text;
    }
}

// Contoh penggunaan:
const logger = new ThonLogger({
    showTimestamp: true,
    logLevel: 'debug' // Set level log global
});

module.exports = {
    logger,
    color: ThonLogger.color,
    bgColor: ThonLogger.bgColor
};
