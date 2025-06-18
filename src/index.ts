import { Elysia } from 'elysia';
import { appConfig } from './config/appConfig';
import { logger } from './lib/terminalLogger';
import { providerManager } from './providers/providerManager';
import { classifyGeminiError } from './lib/commonUtils';
import { messageRoutes } from './routes/messageRoutes';
import { displayStartupBoxes } from './startupDisplay';
import { geminiService } from './providers/gemini/gemini'; // Updated import

console.clear();

const app = new Elysia()
    .onError(({ code, error, set }: { code: string, error: any, set: { status?: number } }) => {
        logger.error(`Error: ${code} - ${String(error)}`);
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
    .use(messageRoutes) // Register message routes
    .get('/health', () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "2.5.0-bun",
        gemini_api_configured: !!appConfig.geminiApiKey,
        api_key_valid_format: appConfig.validateApiKey(),
        streaming_config: {
            force_disabled: appConfig.forceDisableStreaming,
            emergency_disabled: appConfig.emergencyDisableStreaming,
            max_retries: appConfig.maxStreamingRetries,
        }
    }))
    .get('/test-connection', async ({ set }: { set: { status?: number } }) => {
        try {
            const model = geminiService.genAI.getGenerativeModel({ model: appConfig.smallModel });
            const result = await model.generateContent("Hello");
            return {
                status: "success",
                message: "Successfully connected to Gemini API",
                model_used: appConfig.smallModel,
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
            big_model: appConfig.bigModel,
            small_model: appConfig.smallModel,
            available_models: providerManager.getAvailableModels().slice(0, 5),
            max_tokens_limit: appConfig.maxTokensLimit,
            api_key_configured: !!appConfig.geminiApiKey,
            streaming: {
                force_disabled: appConfig.forceDisableStreaming,
                emergency_disabled: appConfig.emergencyDisableStreaming,
                max_retries: appConfig.maxStreamingRetries
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
        hostname: appConfig.host,
        port: appConfig.port
    });

// Initial display of startup boxes
displayStartupBoxes(app.server);

// Re-display startup boxes on terminal resize
process.stdout.on('resize', () => displayStartupBoxes(app.server));