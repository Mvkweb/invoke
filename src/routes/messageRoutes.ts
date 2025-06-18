import { Elysia, t } from 'elysia';
import { appConfig } from '../config/appConfig';
import { providerManager } from '../providers/providerManager';
import { geminiService } from '../providers/gemini/gemini'; // Updated import
import { classifyGeminiError } from '../lib/commonUtils';
import { logger } from '../lib/terminalLogger';
import { MessagesRequest, TokenCountRequest, tMessagesRequest, tTokenCountRequest } from '../types/apiTypes';

export const messageRoutes = new Elysia()
    .post('/v1/messages', async ({ body, set }: { body: MessagesRequest, set: { status?: number } }) => {
        const startTime = performance.now();
        const originalModel = body.model;
        const { mappedModel } = providerManager.validateAndMapModel(originalModel);
        (body as MessagesRequest).originalModel = originalModel;
        
        let geminiRequest;
        try {
            geminiRequest = geminiService.convertAnthropicToGemini(body as MessagesRequest);
        } catch (e: any) {
             const duration = performance.now() - startTime;
             logger.error("Error during request conversion:", e.message);
             logger.logRequest(
                 "POST", "/v1/messages",
                 originalModel, mappedModel,
                 0,
                 body.tools?.length || 0, 400,
                 duration
             );
             set.status = 400;
             return { error: "Bad Request", details: "Failed to convert Anthropic request to Gemini format: " + e.message };
        }

        const geminiModel = geminiService.genAI.getGenerativeModel({
            model: mappedModel,
            generationConfig: {
                maxOutputTokens: Math.min(body.max_tokens, appConfig.maxTokensLimit),
                temperature: body.temperature,
                topP: body.top_p,
                topK: body.top_k,
                stopSequences: body.stop_sequences,
            },
        });
        
        const useStreaming = body.stream && !appConfig.forceDisableStreaming && !appConfig.emergencyDisableStreaming;

        if (useStreaming) {
            for (let i = 0; i <= appConfig.maxStreamingRetries; i++) {
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
                    
                    const sseStream = geminiService.handleStreamingWithRecovery(streamResult.stream, body as MessagesRequest, mappedModel, startTime);
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
                    const duration = performance.now() - startTime;
                    logger.error(`Streaming attempt ${i + 1} failed:`, classifyGeminiError(e));
                    if (i === appConfig.maxStreamingRetries) {
                        logger.error("Max streaming retries reached. Aborting.");
                        logger.logRequest(
                            "POST", "/v1/messages",
                            originalModel, mappedModel,
                            geminiRequest.contents?.length || 0,
                            body.tools?.length || 0, 500,
                            duration
                        );
                        set.status = 500;
                        return { error: "Failed to establish stream with Gemini API.", details: classifyGeminiError(e) };
                    }
                }
            }
        }
        
        // Non-streaming
        try {
            const result = await geminiModel.generateContent(geminiRequest);
            const duration = performance.now() - startTime;
            logger.logRequest(
                "POST", "/v1/messages",
                originalModel, mappedModel,
                geminiRequest.contents?.length || 0,
                body.tools?.length || 0, 200,
                duration
            );
            return geminiService.convertGeminiToAnthropic(
                result.response,
                body as MessagesRequest,
                `msg_${crypto.randomUUID().replace(/-/g, '')}`
            );
        } catch(e: any) {
             const duration = performance.now() - startTime;
             logger.error("Non-streaming request failed:", classifyGeminiError(e));
             logger.logRequest(
                 "POST", "/v1/messages",
                 originalModel, mappedModel,
                 geminiRequest.contents?.length || 0,
                 body.tools?.length || 0, 500,
                 duration
             );
             set.status = 500;
             return { error: "Gemini API Error", details: classifyGeminiError(e) };
        }
    }, {
        body: tMessagesRequest
    })
    .post('/v1/messages/count_tokens', async ({ body, set }: { body: TokenCountRequest, set: { status?: number } }) => {
         const startTime = performance.now();
         const originalModel = body.model;
         const { mappedModel } = providerManager.validateAndMapModel(originalModel);
         
         let geminiRequest;
         try {
            geminiRequest = geminiService.convertAnthropicToGemini(
                { ...body, max_tokens: 1, messages: body.messages } as MessagesRequest
            );
         } catch (e: any) {
             const duration = performance.now() - startTime;
             logger.error("Error during token count request conversion:", e.message);
             logger.logRequest(
                 "POST", "/v1/messages/count_tokens",
                 originalModel, mappedModel,
                 0,
                 body.tools?.length || 0, 400,
                 duration
             );
             set.status = 400;
             return { error: "Bad Request", details: "Failed to convert request format for token counting: " + e.message };
         }

         const geminiModel = geminiService.genAI.getGenerativeModel({ model: mappedModel });

         try {
            const { totalTokens } = await geminiModel.countTokens(geminiRequest);
            const duration = performance.now() - startTime;
            logger.logRequest(
                "POST", "/v1/messages/count_tokens",
                originalModel, mappedModel,
                geminiRequest.contents?.length || 0,
                body.tools?.length || 0, 200,
                duration
            );
            return { input_tokens: totalTokens };
         } catch(e: any) {
             const duration = performance.now() - startTime;
             logger.error("Token counting failed:", classifyGeminiError(e));
             logger.logRequest(
                 "POST", "/v1/messages/count_tokens",
                 originalModel, mappedModel,
                 geminiRequest.contents?.length || 0,
                 body.tools?.length || 0, 500,
                 duration
             );
             set.status = 500;
             return { error: "Token Count Error", details: classifyGeminiError(e) };
         }
    }, {
        body: tTokenCountRequest
    });