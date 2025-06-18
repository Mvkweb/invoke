import { TSchema } from 'elysia'; // Assuming TSchema is needed here or in related files
import { Static } from '@sinclair/typebox'; // Assuming Static is needed here or in related files
import { tContentBlockImage, tContentBlockToolResult } from '../types/apiTypes'; // Assuming these types are needed

// Helper to strip ANSI codes for accurate length calculation
export const stripAnsi = (str: string): string => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
};

export function classifyGeminiError(error: any): string {
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

export function cleanGeminiSchema(schema: any): any {
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

export function parseToolResultContent(content: any): string {
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