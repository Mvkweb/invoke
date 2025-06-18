import { appConfig } from '../config/appConfig';
import { stripAnsi } from './commonUtils'; // Assuming commonUtils will have stripAnsi

export const Colors = {
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
    bg: "\x1b[48;2;25;25;27m", // A darker background color for the footer (RGB 25, 25, 27)
    white: "\x1b[37m",
    gray: "\x1b[38;2;20;20;22m", // RGB(20, 20, 22)
    darkGray: "\x1b[38;2;34;24;26m", // RGB(24, 24, 26) for exit text
    lightGreenGray: "\x1b[38;2;140;160;140m", // Custom gray-ish green
    timestampGray: "\x1b[38;2;100;100;100m", // Custom darker gray for timestamp
};

export const BoxChars = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
};

export const logger = {
    info: (...args: any[]) => console.log(Colors.green, ...args, Colors.reset),
    warn: (...args: any[]) => console.warn(Colors.yellow, ...args, Colors.reset),
    error: (...args: any[]) => console.error(Colors.red, ...args, Colors.reset),
    debug: (...args: any[]) => (appConfig.logLevel === 'debug' ? console.log(Colors.blue, ...args, Colors.reset) : undefined),
    logRequest: (
        method: string,
        path: string,
        requestedModel: string,
        geminiModel: string,
        numMessages: number,
        numTools: number,
        status: number,
        durationMs: number // Added durationMs
    ) => {
        const statusColor = status >= 400 ? Colors.red : Colors.green;
        const statusSymbol = status >= 400 ? '✗' : '✓';
        const durationColor = Colors.timestampGray; // Use new darker gray for duration

        // Construct the single log line
        const logLine = `${statusColor}${statusSymbol}${Colors.reset} ${Colors.white}${method} ${path}${Colors.reset} ${statusColor}${status}${Colors.reset} ${Colors.dim}(${requestedModel} ${Colors.dim}→${Colors.reset} ${Colors.green}${geminiModel}${Colors.dim} • ${Colors.lightGreenGray}${numTools} tools${Colors.dim} • ${Colors.white}${numMessages} messages)${Colors.reset} ${durationColor}[${durationMs.toFixed(2)}ms]${Colors.reset}`;

        console.log(logLine);
    },
    box: (title: string, contentLines: string[], titleColor: string = Colors.cyan, borderColor: string = Colors.gray): string => {
        const terminalWidth = process.stdout.columns || 80; // Get actual terminal width, default to 80
        const padding = 2;
        const titleLength = title.length;
        const maxContentWidth = Math.max(...contentLines.map(line => line.length));
        const boxWidth = Math.max(titleLength + padding * 2, maxContentWidth + padding * 2);
        
        const leftMargin = 1; // Align to the left
        const marginSpace = ' '.repeat(Math.max(0, leftMargin));

        const horizontalLine = BoxChars.horizontal.repeat(boxWidth);

        let boxString = '';
        boxString += `${marginSpace}${borderColor}${BoxChars.topLeft}${horizontalLine}${BoxChars.topRight}${Colors.reset}\n`;
        
        const titlePadding = Math.floor((boxWidth - titleLength) / 2);
        boxString += `${marginSpace}${borderColor}${BoxChars.vertical}${Colors.reset}${titleColor}${Colors.bold}${' '.repeat(titlePadding)}${title}${' '.repeat(boxWidth - titleLength - titlePadding)}${Colors.reset}${borderColor}${BoxChars.vertical}${Colors.reset}\n`;
        
        boxString += `${marginSpace}${borderColor}${BoxChars.vertical}${horizontalLine}${BoxChars.vertical}${Colors.reset}\n`;

        contentLines.forEach(line => {
            const paddedLine = line.padEnd(boxWidth - padding * 2);
            boxString += `${marginSpace}${borderColor}${BoxChars.vertical}${Colors.reset}${' '.repeat(padding)}${paddedLine}${' '.repeat(padding)}${borderColor}${BoxChars.vertical}${Colors.reset}\n`;
        });

        boxString += `${marginSpace}${borderColor}${BoxChars.bottomLeft}${horizontalLine}${BoxChars.bottomRight}${Colors.reset}\n`;
        
        return boxString;
    }
};