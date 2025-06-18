import { appConfig } from './config/appConfig';
import { logger, Colors } from './lib/terminalLogger';
import { stripAnsi } from './lib/commonUtils';

export const displayStartupBoxes = (appServer: { hostname?: string; port?: number } | null) => {
    console.clear();

    const terminalWidth = process.stdout.columns || 80;
    const minWidth = 60;

    if (terminalWidth < minWidth) {
        const message = "Terminal window is too small to display logs properly.";
        const padding = Math.floor((terminalWidth - message.length) / 2);
        console.log(' '.repeat(Math.max(0, padding)) + message);
        console.log('\n');
        return;
    }

    if (!appConfig.geminiApiKey) {
        console.error(logger.box(
            "Configuration Error",
            ["GEMINI_API_KEY not found in environment variables."],
            Colors.red, Colors.gray
        ));
        process.exit(1);
    }

    let buffer = '';

    buffer += logger.box(
        "Configuration Loaded",
        [
            `API Key: ${'*'.repeat(20)}...`,
            `Big Model: ${appConfig.bigModel}`,
            `Small Model: ${appConfig.smallModel}`,
            `Host: ${appConfig.host}`,
            `Port: ${appConfig.port}`,
            `Log Level: ${appConfig.logLevel}`,
            `Max Tokens Limit: ${appConfig.maxTokensLimit}`,
            `Request Timeout: ${appConfig.requestTimeout}ms`,
            `Max Retries: ${appConfig.maxRetries}`,
            `Max Streaming Retries: ${appConfig.maxStreamingRetries}`,
            `Force Disable Streaming: ${appConfig.forceDisableStreaming}`,
            `Emergency Disable Streaming: ${appConfig.emergencyDisableStreaming}`,
        ],
        Colors.green, Colors.gray
    );

    buffer += '\n';

    buffer += logger.box(
        "Server Running",
        [
            `Version: v2.5.0 (Bun/ElysiaJS)`,
            `Host: ${appServer?.hostname}`,
            `Port: ${appServer?.port}`,
            `URL: http://${appServer?.hostname}:${appServer?.port}`,
        ],
        Colors.blue, Colors.gray
    );

    const footerStatus = `${Colors.green}${Colors.bold}\x1b[5m ●\x1b[25m HEALTHY ${Colors.reset}`;
    const leadingSpaces = ' ';
    const staticText = ` | Listening on ${Colors.cyan}${appConfig.host}:${appConfig.port}${Colors.reset} | ${Colors.darkGray}Press CTRL+C to exit${Colors.reset} `;

    const visibleStatusLength = stripAnsi(footerStatus).length;
    const visibleLineWithoutFill = leadingSpaces.length + visibleStatusLength + stripAnsi(staticText).length;
    const footerFill = ' '.repeat(Math.max(0, terminalWidth - visibleLineWithoutFill));

    buffer += `${leadingSpaces}${Colors.bg}${footerStatus}${Colors.reset}${staticText}${footerFill}\n`;

    process.stdout.write(buffer);
};