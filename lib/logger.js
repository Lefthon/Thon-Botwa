const chalk = require('chalk');

const color = (text, color) => {
    return chalk[color] ? chalk[color](text) : chalk.green(text);
};

const bgColor = (text, bgColor) => {
    return chalk[bgColor] ? chalk[bgColor](text) : chalk.bgGreen(text);
};

module.exports = {
    color,
    bgColor
};
