const fs = require('fs');
const path = require('path');

function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function sanitizeNumber(number) {
    return number.replace(/[^0-9]/g, '');
}

module.exports = {
    ensureDirectoryExists,
    sanitizeNumber
};
