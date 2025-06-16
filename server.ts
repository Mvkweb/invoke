console.clear();
import { Elysia, t, TSchema } from 'elysia';

import type { Static } from '@sinclair/typebox';
import {
    GoogleGenerativeAI,
    GenerativeModel,
    Content,
    Part,
    Tool as GeminiTool,
    FunctionDeclaration,
    FunctionCall,
    GenerateContentRequest,
    EnhancedGenerateContentResponse,
    CountTokensRequest,
    FunctionCallingMode, // Added FunctionCallingMode
} from '@google/generative-ai';


// --- Constants ---
const Constants = {
    ROLE_USER: 'user',
    ROLE_ASSISTANT: 'model', // Gemini uses 'model' for assistant
    ROLE_FUNCTION: 'function',
    
    CONTENT_TEXT: 'text',
    CONTENT_IMAGE: 'image',
    CONTENT_TOOL_USE: 'tool_use',
    CONTENT_TOOL_RESULT: 'tool_result',
    
    STOP_END_TURN: 'end_turn',
    STOP_MAX_TOKENS: 'max_tokens',
    STOP_TOOL_USE: 'tool_use',
    STOP_ERROR: 'error',
    
    EVENT_MESSAGE_START: 'message_start',
    EVENT_MESSAGE_STOP: 'message_stop',
    EVENT_MESSAGE_DELTA: 'message_delta',
    EVENT_CONTENT_BLOCK_START: 'content_block_start',
    EVENT_CONTENT_BLOCK_STOP: 'content_block_stop',
    EVENT_CONTENT_BLOCK_DELTA: 'content_block_delta',
    EVENT_PING: 'ping',
    
    DELTA_TEXT: 'text_delta',
    DELTA_INPUT_JSON: 'input_json_delta',
} as const;

// --- Simple Configuration ---
// Bun automatically loads .env files
const config = {
    geminiApiKey: Bun.env.GEMINI_API_KEY,
    bigModel: Bun.env.BIG_MODEL || 'gemini-1.5-pro-latest',
    smallModel: Bun.env.SMALL_MODEL || 'gemini-1.5-flash-latest',
    host: Bun.env.HOST || '0.0.0.0',
    port: parseInt(Bun.env.PORT || '8082', 10),
    logLevel: Bun.env.LOG_LEVEL || 'info',
    maxTokensLimit: parseInt(Bun.env.MAX_TOKENS_LIMIT || '8192', 10),
    requestTimeout: parseInt(Bun.env.REQUEST_TIMEOUT || '90000', 10), // ms
    maxRetries: parseInt(Bun.env.MAX_RETRIES || '2', 10),
    maxStreamingRetries: parseInt(Bun.env.MAX_STREAMING_RETRIES || '12', 10),
    forceDisableStreaming: (Bun.env.FORCE_DISABLE_STREAMING || 'false').toLowerCase() === 'true',
    emergencyDisableStreaming: (Bun.env.EMERGENCY_DISABLE_STREAMING || 'false').toLowerCase() === 'true',
    
    validateApiKey: () => {
        if (!config.geminiApiKey) return false;
        return config.geminiApiKey.startsWith('AIza') && config.geminiApiKey.length === 39;
    }
};


const displayStartupBoxes = () => {
    console.clear();

    const terminalWidth = process.stdout.columns || 80;
    const minWidth = 60; // Minimum width required for the boxes

    if (terminalWidth < minWidth) {
        const message = "Terminal window is too small to display logs properly.";
        const padding = Math.floor((terminalWidth - message.length) / 2);
        // console.log('\n'.repeat(Math.floor(process.stdout.rows / 2) - 2)); // Center vertically roughly
        console.log(' '.repeat(Math.max(0, padding)) + message);
        console.log('\n');
        return;
    }

    if (!config.geminiApiKey) {
        console.error(logger.box(
            "Configuration Error",
            ["GEMINI_API_KEY not found in environment variables."],
            Colors.red, Colors.gray
        ));
        process.exit(1);
        process.exit(1);
    }

    let buffer = ''; // Initialize buffer

    buffer += logger.box( // Append first box
        "Configuration Loaded",
        [
            `API Key: ${'*'.repeat(20)}...`,
            `Big Model: ${config.bigModel}`,
            `Small Model: ${config.smallModel}`,
            `Host: ${config.host}`,
            `Port: ${config.port}`,
            `Log Level: ${config.logLevel}`,
            `Max Tokens Limit: ${config.maxTokensLimit}`,
            `Request Timeout: ${config.requestTimeout}ms`,
            `Max Retries: ${config.maxRetries}`,
            `Max Streaming Retries: ${config.maxStreamingRetries}`,
            `Force Disable Streaming: ${config.forceDisableStreaming}`,
            `Emergency Disable Streaming: ${config.emergencyDisableStreaming}`,
        ],
        Colors.green, Colors.gray
    );

    buffer += '\n'; // Add spacing between boxes

    buffer += logger.box( // Append second box
        "Server Running",
        [
            `Version: v2.5.0 (Bun/ElysiaJS)`,
            `Host: ${app.server?.hostname}`,
            `Port: ${app.server?.port}`,
            `URL: http://${app.server?.hostname}:${app.server?.port}`,
        ],
        Colors.blue, Colors.gray
    );

    // Footer
    const footerStatus = `${Colors.green}${Colors.bold}\x1b[5m●\x1b[25m HEALTHY${Colors.reset}`; // Added blinking (\x1b[5m) and bold (\x1b[1m), removed bold from Colors.green
    const footerText = `    ${footerStatus} | Listening on ${Colors.cyan}${config.host}:${config.port}${Colors.reset} | ${Colors.darkGray}Press CTRL+C to exit${Colors.reset} `; // Added 3 more spaces and applied darkGray color
    const footerFill = ' '.repeat(terminalWidth - stripAnsi(footerText).length); // Use terminalWidth
    buffer += `${Colors.bg}${footerText}${footerFill}${Colors.reset}\n`;

    process.stdout.write(buffer); // Write the entire buffer

};

// Helper to strip ANSI codes for accurate length calculation
const stripAnsi = (str: string): string => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
};
// --- Simple Colored Logger ---
const Colors = {
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
};

const BoxChars = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
};

const logger = {
    info: (...args: any[]) => console.log(Colors.green, ...args, Colors.reset),
    warn: (...args: any[]) => console.warn(Colors.yellow, ...args, Colors.reset),
    error: (...args: any[]) => console.error(Colors.red, ...args, Colors.reset),
    debug: (...args: any[]) => (config.logLevel === 'debug' ? console.log(Colors.blue, ...args, Colors.reset) : undefined),
    logRequest: (
        method: string,
        path: string,
        requestedModel: string,
        geminiModel: string,
        numMessages: number,
        numTools: number,
        status: number
    ) => {
        const statusColor = status >= 400 ? Colors.red : Colors.green;
        const statusSymbol = status >= 400 ? '✗' : '✓';
        
        console.log(`${Colors.bold}${method} ${path}${Colors.reset} ${statusColor}${statusSymbol} ${status}${Colors.reset}`);
        console.log(`  Request: ${Colors.cyan}${requestedModel}${Colors.reset} → Gemini: ${Colors.green}${geminiModel}${Colors.reset} (${Colors.magenta}${numTools} tools${Colors.reset}, ${Colors.blue}${numMessages} messages${Colors.reset})`);
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

// --- Model Management ---
class ModelManager {
    private geminiModels: Set<string>;

    constructor() {
        this.geminiModels = new Set([
            "gemini-1.5-pro-latest", "gemini-1.5-pro-preview-0514",
            "gemini-1.5-flash-latest", "gemini-1.5-flash-preview-0514",
            "gemini-pro",
        ]);
        this.geminiModels.add(config.bigModel);
        this.geminiModels.add(config.smallModel);
    }

    getAvailableModels(): string[] {
        return Array.from(this.geminiModels).sort();
    }

    private cleanModelName(model: string): string {
        return model.replace(/^(gemini|anthropic|openai)\//, '');
    }

    private mapModelAlias(cleanModel: string): string {
        const modelLower = cleanModel.toLowerCase();
        if (modelLower.includes('haiku')) return config.smallModel;
        if (modelLower.includes('sonnet') || modelLower.includes('opus')) return config.bigModel;
        return cleanModel;
    }

    validateAndMapModel(originalModel: string): { mappedModel: string; wasMapped: boolean } {
        const cleanModel = this.cleanModelName(originalModel);
        const mapped = this.mapModelAlias(cleanModel);
        
        if (mapped !== cleanModel) {
            return { mappedModel: mapped, wasMapped: true };
        }
        if (this.geminiModels.has(cleanModel)) {
            return { mappedModel: cleanModel, wasMapped: false };
        }
        return { mappedModel: cleanModel, wasMapped: false }; // Pass through unknown models
    }
}
const modelManager = new ModelManager();


// --- Pydantic -> TypeBox Schema Definitions ---
const tAny = t.Any();
const tContentBlockText = t.Object({ type: t.Literal('text'), text: t.String() });
const tContentBlockImageSource = t.Object({ type: t.Literal('base64'), media_type: t.String(), data: t.String() });
const tContentBlockImage = t.Object({ type: t.Literal('image'), source: tContentBlockImageSource });
const tContentBlockToolUse = t.Object({ type: t.Literal('tool_use'), id: t.String(), name: t.String(), input: t.Record(t.String(), tAny) });
const tContentBlockToolResult = t.Object({ type: t.Literal('tool_result'), tool_use_id: t.String(), content: t.Union([t.String(), t.Array(t.Record(t.String(), tAny)), t.Record(t.String(), tAny)]) });

const tContentBlock = t.Union([tContentBlockText, tContentBlockImage, tContentBlockToolUse, tContentBlockToolResult]);

const tMessage = t.Object({
    role: t.Union([t.Literal('user'), t.Literal('assistant')]),
    content: t.Union([t.String(), t.Array(tContentBlock)])
});

const tSystemContent = t.Object({ type: t.Literal('text'), text: t.String() });

const tTool = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
    input_schema: t.Record(t.String(), tAny)
});

const tMessagesRequest = t.Object({
    model: t.String(),
    max_tokens: t.Integer(),
    messages: t.Array(tMessage),
    system: t.Optional(t.Union([t.String(), t.Array(tSystemContent)])),
    stop_sequences: t.Optional(t.Array(t.String())),
    stream: t.Optional(t.Boolean({ default: false })),
    temperature: t.Optional(t.Number({ minimum: 0, maximum: 2, default: 1.0 })),
    top_p: t.Optional(t.Number()),
    top_k: t.Optional(t.Integer()),
    metadata: t.Optional(t.Record(t.String(), tAny)),
    tools: t.Optional(t.Array(tTool)),
    tool_choice: t.Optional(t.Record(t.String(), tAny)),
});
type MessagesRequest = Static<typeof tMessagesRequest> & { originalModel?: string }; // Augment type

const tTokenCountRequest = t.Object({
    model: t.String(),
    messages: t.Array(tMessage),
    system: t.Optional(t.Union([t.String(), t.Array(tSystemContent)])),
    tools: t.Optional(t.Array(tTool)),
});
type TokenCountRequest = Static<typeof tTokenCountRequest> & { originalModel?: string };

// --- Gemini SDK Initialization ---
const genAI = new GoogleGenerativeAI(config.geminiApiKey!); // Assert non-null after check in displayStartupBoxes

// --- Conversion & Utility Logic ---

function classifyGeminiError(error: any): string {
    const errorMessage = (error?.message || String(error)).toLowerCase();
    
    // Prioritize API-specific errors
    if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        return "Rate limit or quota exceeded. Check your Google Cloud Console for quota limits.";
    }
    if (errorMessage.includes("api key") || errorMessage.includes("authentication") || errorMessage.includes("unauthorized")) {
        return "API key error. Please check that your GEMINI_API_KEY is valid and has the necessary permissions.";
    }
    if (errorMessage.includes("safety") || (errorMessage.includes("content") && errorMessage.includes("filter"))) {
        return "Content filtered by Gemini's safety systems. Please modify your request.";
    }
    if (errorMessage.includes("token") && (errorMessage.includes("limit") || errorMessage.includes("exceed"))) {
        return "Token limit exceeded. Reduce the length of your request or increase max_tokens.";
    }
    if (errorMessage.includes("function_declarations") && errorMessage.includes("format")) {
        return "Tool schema error: Gemini only supports 'enum' and 'date-time' formats for string parameters. Remove other formats like 'uri'.";
    }
    if (errorMessage.includes("function_declarations") && errorMessage.includes("$schema")) {
        return "Tool schema error: The '$schema' key is not allowed in tool parameter definitions. It has been automatically removed, but the request may have other issues.";
    }

    // Then handle generic streaming/SDK errors
    if (errorMessage.includes("is not a function")) {
        return "Streaming iteration error: The Gemini API returned an invalid stream object. This might be due to an incorrect model name, or an underlying API error (e.g., rate limit) causing a malformed response.";
    }
    if (errorMessage.includes("returned undefined")) {
        return "The Gemini SDK returned an undefined stream, which often indicates an invalid model name or a problem with the API endpoint. Please check your configured model names.";
    }
    return error?.message || String(error);
}

function cleanGeminiSchema(schema: any): any {
    if (typeof schema !== 'object' || schema === null) {
        return schema;
    }
    if (Array.isArray(schema)) {
        return schema.map(cleanGeminiSchema);
    }
    const result: Record<string, any> = {};
    for (const key in schema) {
        if (key === '$schema' || key === 'additionalProperties' || key === 'default') {
            continue;
        }
        result[key] = cleanGeminiSchema(schema[key]);
    }
    if (result.type === 'string' && result.format && !['enum', 'date-time'].includes(result.format)) {
        delete result.format;
    }
    return result;
}

function parseToolResultContent(content: any): string {
    if (content === null || content === undefined) return "No content provided";
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
        return content.map(item => {
            if (typeof item === 'string') return item;
            if (item?.type === 'text' && typeof item.text === 'string') return item.text;
            return JSON.stringify(item);
        }).join('\n');
    }

    if (typeof content === 'object') {
        if (content?.type === 'text' && typeof content.text === 'string') return content.text;
        try {
            return JSON.stringify(content);
        } catch {
            return String(content);
        }
    }
    return String(content);
}

function convertAnthropicToGemini(request: MessagesRequest): GenerateContentRequest {
    const geminiContents: Content[] = [];
    let systemInstruction: Part | undefined = undefined;

    // System prompt
    if (request.system) {
        const systemText = typeof request.system === 'string'
            ? request.system
            : request.system.map(s => s.text).join('\n\n');
        if (systemText.trim()) {
            systemInstruction = { text: systemText.trim() };
        }
    }

    // Messages
    for (const msg of request.messages) {
        const parts: Part[] = [];
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let currentContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content as string }];
        
        let textBuffer = "";

        for(const block of currentContent) {
            switch(block.type) {
                case 'text':
                    textBuffer += block.text;
                    break;
                case 'image':
                    const imageBlock = block as Static<typeof tContentBlockImage>;
                    parts.push({
                        inlineData: {
                            mimeType: imageBlock.source.media_type,
                            data: imageBlock.source.data
                        }
                    });
                    break;
                case 'tool_use': // This is on an 'assistant' message
                    const toolUseBlock = block as Static<typeof tContentBlockToolUse>;
                    parts.push({
                        functionCall: {
                            name: toolUseBlock.name,
                            args: toolUseBlock.input,
                        }
                    });
                    break;
                case 'tool_result': // This is on a 'user' message
                    const toolResultBlock = block as Static<typeof tContentBlockToolResult>;
                    if (textBuffer.trim() || parts.length > 0) {
                         if(textBuffer.trim()) parts.unshift({ text: textBuffer.trim() });
                         geminiContents.push({ role: 'user', parts });
                         textBuffer = "";
                         parts.length = 0;
                    }
                    geminiContents.push({
                        role: 'function',
                        parts: [{
                            functionResponse: {
                                name: "tool_code",
                                response: {
                                    name: toolResultBlock.tool_use_id,
                                    content: parseToolResultContent(toolResultBlock.content),
                                }
                            }
                        }]
                    });
                    break;
            }
        }
        
        if (textBuffer.trim()) {
            parts.unshift({ text: textBuffer.trim() });
        }

        if (parts.length > 0) {
            if (role === 'model' && parts.every(p => !p.text && !p.functionCall)) {
                continue;
            }
            geminiContents.push({ role, parts });
        }
    }
    
    const geminiRequest: GenerateContentRequest = {
        contents: geminiContents,
    };
    
    if (systemInstruction) {
        geminiRequest.systemInstruction = systemInstruction;
    }
    
    if (request.tools) {
        geminiRequest.tools = [{
            functionDeclarations: request.tools.map(tool => ({
                name: tool.name,
                description: tool.description || '',
                parameters: cleanGeminiSchema(tool.input_schema)
            }))
        }];
    }
    
    if (request.tool_choice?.type === "tool" && request.tool_choice.name) {
        geminiRequest.toolConfig = {
            functionCallingConfig: {
                mode: FunctionCallingMode.AUTO, // Use AUTO for specific tool calls
                allowedFunctionNames: [request.tool_choice.name]
            }
        };
    } else if (request.tool_choice?.type === "any" || request.tool_choice?.type === "auto") {
         geminiRequest.toolConfig = {
            functionCallingConfig: {
                mode: FunctionCallingMode.ANY, // Use ANY for auto tool calling
            }
        };
    }

    return geminiRequest;
}

function convertGeminiToAnthropic(
    geminiResponse: EnhancedGenerateContentResponse,
    originalRequest: MessagesRequest,
    messageId: string
) {
    const contentBlocks: (Static<typeof tContentBlockText> | Static<typeof tContentBlockToolUse>)[] = [];
    let stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'error' = 'end_turn';
    
    // EnhancedGenerateContentResponse is the response itself, not nested under .response
    const text = geminiResponse.text();
    const functionCalls = geminiResponse.functionCalls();

    if (text) {
        contentBlocks.push({ type: 'text', text });
    }

    if (functionCalls && functionCalls.length > 0) {
        stopReason = 'tool_use';
        for (const call of functionCalls) {
            contentBlocks.push({
                type: 'tool_use',
                id: call.name + "_" + Math.random().toString(36).substring(2, 10),
                name: call.name,
                input: call.args
            });
        }
    }
    
    if (geminiResponse.candidates?.[0]?.finishReason === 'MAX_TOKENS') { // Access candidates directly from geminiResponse
        stopReason = 'max_tokens';
    }

    if (contentBlocks.length === 0) {
        contentBlocks.push({ type: 'text', text: '' });
    }

    return {
        id: messageId,
        model: originalRequest.originalModel || originalRequest.model,
        role: 'assistant',
        content: contentBlocks,
        type: 'message',
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
            input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
            output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        }
    };
}

async function* handleStreamingWithRecovery(
    stream: AsyncGenerator<EnhancedGenerateContentResponse>,
    originalRequest: MessagesRequest
): AsyncGenerator<string> {
    const messageId = `msg_${crypto.randomUUID().replace(/-/g, '')}`;
    
    yield `event: ${Constants.EVENT_MESSAGE_START}\ndata: ${JSON.stringify({type: Constants.EVENT_MESSAGE_START, message: {id: messageId, type: 'message', role: 'assistant', model: originalRequest.originalModel || originalRequest.model, content: [], stop_reason: null, stop_sequence: null, usage: {input_tokens: 0, output_tokens: 0}}})}\n\n`;
    yield `event: ${Constants.EVENT_PING}\ndata: ${JSON.stringify({type: Constants.EVENT_PING})}\n\n`;

    let textBlockIndex = 0;
    let toolBlockCounter = 0;
    const currentToolCalls: Record<string, { index: number; name: string; args_buffer: string }> = {};
    let usageMetadata: EnhancedGenerateContentResponse['usageMetadata'] | undefined;
    let finalStopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'error' = 'end_turn';
    
    let textBlockStarted = false;
    let streamFailed = false;

    // --- [FIX APPLIED HERE] ---
    // Wrap the entire iteration in a try...catch to handle cases where `stream` is not a valid AsyncIterator.
    try {
        for await (const chunk of stream) {
            logger.debug("Received stream chunk:", JSON.stringify(chunk)); // Added debug log
            if (!textBlockStarted && chunk.text()) {
                 yield `event: ${Constants.EVENT_CONTENT_BLOCK_START}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_START, index: textBlockIndex, content_block: {type: 'text', text: ''}})}\n\n`;
                 textBlockStarted = true;
            }

            if (chunk.text()) {
                 yield `event: ${Constants.EVENT_CONTENT_BLOCK_DELTA}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_DELTA, index: textBlockIndex, delta: {type: 'text_delta', text: chunk.text()}})}\n\n`;
            }
            
            const functionCalls = chunk.functionCalls();
            if(functionCalls){
                for(const call of functionCalls){
                    const toolCallId = call.name + "_" + Math.random().toString(36).substring(2, 10);
                    if (!currentToolCalls[toolCallId]) {
                        toolBlockCounter++;
                        const toolIndex = textBlockIndex + toolBlockCounter;
                        currentToolCalls[toolCallId] = {
                            index: toolIndex,
                            name: call.name,
                            args_buffer: JSON.stringify(call.args)
                        };
                        yield `event: ${Constants.EVENT_CONTENT_BLOCK_START}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_START, index: toolIndex, content_block: {type: 'tool_use', id: toolCallId, name: call.name, input: {}}})}\n\n`;
                        yield `event: ${Constants.EVENT_CONTENT_BLOCK_DELTA}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_DELTA, index: toolIndex, delta: {type: 'input_json_delta', partial_json: JSON.stringify(call.args)}})}\n\n`;
                    }
                }
            }
            
            usageMetadata = chunk.usageMetadata;
            const finishReason = chunk.candidates?.[0]?.finishReason; // Access candidates directly from chunk
            if (finishReason) {
                if (finishReason === 'MAX_TOKENS') finalStopReason = 'max_tokens';
                else if (functionCalls && functionCalls.length > 0) finalStopReason = 'tool_use'; // If function calls are present, it's tool_use
                else if (finishReason === 'STOP') finalStopReason = 'end_turn'; // STOP is a general end reason
                else finalStopReason = 'error'; // Default to error for other unexpected finish reasons
            }
        }
    } catch (e: any) {
        logger.error(`Fatal streaming error: ${classifyGeminiError(e)}`);
        logger.error("Raw streaming error object:", e); // Added raw error object log
        streamFailed = true;
        finalStopReason = 'error';
    }
    
    // Final events
    if (textBlockStarted) {
        yield `event: ${Constants.EVENT_CONTENT_BLOCK_STOP}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_STOP, index: textBlockIndex})}\n\n`;
    }

    for (const toolId in currentToolCalls) {
        yield `event: ${Constants.EVENT_CONTENT_BLOCK_STOP}\ndata: ${JSON.stringify({type: Constants.EVENT_CONTENT_BLOCK_STOP, index: currentToolCalls[toolId].index})}\n\n`;
    }
    
    if (streamFailed && finalStopReason === 'end_turn') {
        finalStopReason = 'error';
    }

    const usageData = {
        input_tokens: usageMetadata?.promptTokenCount || 0,
        output_tokens: usageMetadata?.candidatesTokenCount || 0
    };
    yield `event: ${Constants.EVENT_MESSAGE_DELTA}\ndata: ${JSON.stringify({type: Constants.EVENT_MESSAGE_DELTA, delta: {stop_reason: finalStopReason, stop_sequence: null}, usage: usageData})}\n\n`;
    yield `event: ${Constants.EVENT_MESSAGE_STOP}\ndata: ${JSON.stringify({type: Constants.EVENT_MESSAGE_STOP})}\n\n`;
}


// --- Elysia App ---

const app = new Elysia()
    .onError(({ code, error, set }) => {
        logger.error(`Error: ${code} - ${String(error)}`); // Safely access error message
        const classifiedError = classifyGeminiError(error);
        
        switch (code) {
            case 'VALIDATION':
                set.status = 422;
                return { error: "Validation Error", details: error.message };
            case 'NOT_FOUND':
                 set.status = 404;
                 return { error: "Not Found" };
            default:
                 set.status = 500;
                 return { error: "Internal Server Error", details: classifiedError };
        }
    })
    .post('/v1/messages', async ({ body, set }) => {
        const originalModel = body.model;
        const { mappedModel } = modelManager.validateAndMapModel(originalModel);
        (body as MessagesRequest).originalModel = originalModel;
        
        let geminiRequest: GenerateContentRequest;
        try {
            geminiRequest = convertAnthropicToGemini(body as MessagesRequest);
        } catch (e: any) {
             logger.error("Error during request conversion:", e.message);
             set.status = 400;
             return { error: "Bad Request", details: "Failed to convert Anthropic request to Gemini format: " + e.message };
        }

        const geminiModel = genAI.getGenerativeModel({
            model: mappedModel,
            generationConfig: {
                maxOutputTokens: Math.min(body.max_tokens, config.maxTokensLimit),
                temperature: body.temperature,
                topP: body.top_p,
                topK: body.top_k,
                stopSequences: body.stop_sequences,
            },
        });
        
        logger.logRequest(
            "POST", "/v1/messages", 
            originalModel, mappedModel, 
            geminiRequest.contents?.length || 0,
            body.tools?.length || 0, 200
        );

        const useStreaming = body.stream && !config.forceDisableStreaming && !config.emergencyDisableStreaming;

        if (useStreaming) {
            for (let i = 0; i <= config.maxStreamingRetries; i++) {
                try {
                    if (i > 0) {
                        const delay = Math.min(500 * (2 ** (i - 1)), 2000);
                        logger.warn(`Streaming attempt ${i + 1} failed. Retrying in ${delay}ms...`);
                        await new Promise(res => setTimeout(res, delay));
                    }
                    const streamResult = await geminiModel.generateContentStream(geminiRequest);
                    
                    if (!streamResult.stream || typeof streamResult.stream[Symbol.asyncIterator] !== 'function') {
                        logger.error("Gemini API returned an invalid stream object:", streamResult);
                        throw new Error("geminiModel.generateContentStream returned an invalid or non-iterable stream object.");
                    }
                    
                    const sseStream = handleStreamingWithRecovery(streamResult.stream, body as MessagesRequest);
                    return new Response(new ReadableStream({
                        async pull(controller) {
                            const { value, done } = await sseStream.next();
                            if (done) {
                                controller.close();
                            } else {
                                controller.enqueue(new TextEncoder().encode(value));
                            }
                        }
                    }), {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        }
                    });
                } catch (e: any) {
                    logger.error(`Streaming attempt ${i + 1} failed:`, classifyGeminiError(e));
                    if (i === config.maxStreamingRetries) {
                        logger.error("Max streaming retries reached. Aborting.");
                        set.status = 500;
                        return { error: "Failed to establish stream with Gemini API.", details: classifyGeminiError(e) };
                    }
                }
            }
        }
        
        // Non-streaming
        try {
            const result = await geminiModel.generateContent(geminiRequest);
            return convertGeminiToAnthropic(
                result.response,
                body as MessagesRequest,
                `msg_${crypto.randomUUID().replace(/-/g, '')}`
            );
        } catch(e: any) {
             logger.error("Non-streaming request failed:", classifyGeminiError(e));
             set.status = 500;
             return { error: "Gemini API Error", details: classifyGeminiError(e) };
        }
    }, {
        body: tMessagesRequest
    })
    .post('/v1/messages/count_tokens', async ({ body, set }) => {
         const originalModel = body.model;
         const { mappedModel } = modelManager.validateAndMapModel(originalModel);
         
         let geminiRequest: CountTokensRequest;
         try {
            geminiRequest = convertAnthropicToGemini(
                { ...body, max_tokens: 1, messages: body.messages } as MessagesRequest
            );
         } catch (e: any) {
             logger.error("Error during token count request conversion:", e.message);
             set.status = 400;
             return { error: "Bad Request", details: "Failed to convert request format for token counting: " + e.message };
         }

         const geminiModel = genAI.getGenerativeModel({ model: mappedModel });

         logger.logRequest(
            "POST", "/v1/messages/count_tokens", 
            originalModel, mappedModel, 
            geminiRequest.contents?.length || 0,
            body.tools?.length || 0, 200
        );

         try {
            const { totalTokens } = await geminiModel.countTokens(geminiRequest);
            return { input_tokens: totalTokens };
         } catch(e: any) {
             logger.error("Token counting failed:", classifyGeminiError(e));
             set.status = 500;
             return { error: "Token Count Error", details: classifyGeminiError(e) };
         }
    }, {
        body: tTokenCountRequest
    })
    .get('/health', () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "2.5.0-bun",
        gemini_api_configured: !!config.geminiApiKey,
        api_key_valid_format: config.validateApiKey(),
        streaming_config: {
            force_disabled: config.forceDisableStreaming,
            emergency_disabled: config.emergencyDisableStreaming,
            max_retries: config.maxStreamingRetries,
        }
    }))
    .get('/test-connection', async ({ set }) => {
        try {
            const model = genAI.getGenerativeModel({ model: config.smallModel });
            const result = await model.generateContent("Hello");
            return {
                status: "success",
                message: "Successfully connected to Gemini API",
                model_used: config.smallModel,
                timestamp: new Date().toISOString(),
                response_id: result.response.candidates?.[0]?.index || 'unknown',
            };
        } catch(e: any) {
            logger.error("API connectivity test failed:", classifyGeminiError(e));
            set.status = 503;
            return {
                status: "failed",
                error_type: "API Error",
                message: classifyGeminiError(e),
                suggestions: [
                    "Check your GEMINI_API_KEY is valid",
                    "Verify your API key has the necessary permissions",
                    "Check if you have reached rate limits",
                ]
            };
        }
    })
    .get('/', () => ({
        message: "Enhanced Gemini-to-Claude API Proxy v2.5.0 (Bun/ElysiaJS)",
        status: "running",
        config: {
            big_model: config.bigModel,
            small_model: config.smallModel,
            available_models: modelManager.getAvailableModels().slice(0, 5),
            max_tokens_limit: config.maxTokensLimit,
            api_key_configured: !!config.geminiApiKey,
            streaming: {
                force_disabled: config.forceDisableStreaming,
                emergency_disabled: config.emergencyDisableStreaming,
                max_retries: config.maxStreamingRetries
            }
        },
        endpoints: {
            messages: "/v1/messages",
            count_tokens: "/v1/messages/count_tokens", 
            health: "/health",
            test_connection: "/test-connection"
        }
    }))
    .listen({
        hostname: config.host,
        port: config.port
    });

// Initial display of startup boxes
displayStartupBoxes();

// Re-display startup boxes on terminal resize
process.stdout.on('resize', displayStartupBoxes);
