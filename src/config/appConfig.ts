export const appConfig = {
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
        if (!appConfig.geminiApiKey) return false;
        return appConfig.geminiApiKey.startsWith('AIza') && appConfig.geminiApiKey.length === 39;
    }
};