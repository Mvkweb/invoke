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
    FunctionCallingMode,
} from '@google/generative-ai';
import { Static } from '@sinclair/typebox';
import { appConfig } from '../../config/appConfig';
import { Constants } from '../../constants/apiConstants';
import { classifyGeminiError, parseToolResultContent, cleanGeminiSchema } from '../../lib/commonUtils';
import { logger } from '../../lib/terminalLogger';
import { MessagesRequest, TokenCountRequest, tContentBlockImage, tContentBlockToolUse, tContentBlockToolResult } from '../../types/apiTypes';

// --- Gemini SDK Initialization ---
const genAI = new GoogleGenerativeAI(appConfig.geminiApiKey!); // Assert non-null after check in displayStartupBoxes

// --- Conversion & Utility Logic ---

export function convertAnthropicToGemini(request: MessagesRequest): GenerateContentRequest {
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
                                name: "tool_code", // Gemini requires a function name here
                                response: {
                                    name: toolResultBlock.tool_use_id, // Using tool_use_id as the response name
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

export function convertGeminiToAnthropic(
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

export async function* handleStreamingWithRecovery(
    stream: AsyncGenerator<EnhancedGenerateContentResponse>,
    originalRequest: MessagesRequest,
    mappedModel: string,
    startTime: number
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

    try {
        for await (const chunk of stream) {
            logger.debug("Received stream chunk:", JSON.stringify(chunk));
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
                        yield `event: ${Constants.EVENT_CONTENT_BLOCK_DELTA}\ndata: ${JSON.stringify({type: Constants.DELTA_INPUT_JSON, index: toolIndex, delta: {type: 'input_json_delta', partial_json: JSON.stringify(call.args)}})}\n\n`;
                    }
                }
            }
            
            usageMetadata = chunk.usageMetadata;
            const finishReason = chunk.candidates?.[0]?.finishReason;
            if (finishReason) {
                if (finishReason === 'MAX_TOKENS') finalStopReason = 'max_tokens';
                else if (functionCalls && functionCalls.length > 0) finalStopReason = 'tool_use';
                else if (finishReason === 'STOP') finalStopReason = 'end_turn';
                else finalStopReason = 'error';
            }
        }
    } catch (e: any) {
        logger.error(`Fatal streaming error: ${classifyGeminiError(e)}`);
        logger.error("Raw streaming error object:", e);
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
    
    const duration = performance.now() - startTime;
    logger.logRequest(
        "POST", "/v1/messages",
        originalRequest.originalModel || originalRequest.model, mappedModel,
        usageData.input_tokens,
        originalRequest.tools?.length || 0,
        streamFailed ? 500 : 200,
        duration
    );

    yield `event: ${Constants.EVENT_MESSAGE_DELTA}\ndata: ${JSON.stringify({type: Constants.EVENT_MESSAGE_DELTA, delta: {stop_reason: finalStopReason, stop_sequence: null}, usage: usageData})}\n\n`;
    yield `event: ${Constants.EVENT_MESSAGE_STOP}\ndata: ${JSON.stringify({type: Constants.EVENT_MESSAGE_STOP})}\n\n`;
}

export const geminiService = {
    genAI,
    convertAnthropicToGemini,
    convertGeminiToAnthropic,
    handleStreamingWithRecovery,
};