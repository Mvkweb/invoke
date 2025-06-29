export const Constants = {
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