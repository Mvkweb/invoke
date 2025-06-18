import { t, TSchema } from 'elysia';
import type { Static } from '@sinclair/typebox';

export const tAny = t.Any();

export const tContentBlockText = t.Object({ type: t.Literal('text'), text: t.String() });
export const tContentBlockImageSource = t.Object({ type: t.Literal('base64'), media_type: t.String(), data: t.String() });
export const tContentBlockImage = t.Object({ type: t.Literal('image'), source: tContentBlockImageSource });
export const tContentBlockToolUse = t.Object({ type: t.Literal('tool_use'), id: t.String(), name: t.String(), input: t.Record(t.String(), tAny) });
export const tContentBlockToolResult = t.Object({ type: t.Literal('tool_result'), tool_use_id: t.String(), content: t.Union([t.String(), t.Array(t.Record(t.String(), tAny)), t.Record(t.String(), tAny)]) });

export const tContentBlock = t.Union([tContentBlockText, tContentBlockImage, tContentBlockToolUse, tContentBlockToolResult]);

export const tMessage = t.Object({
    role: t.Union([t.Literal('user'), t.Literal('assistant')]),
    content: t.Union([t.String(), t.Array(tContentBlock)])
});

export const tSystemContent = t.Object({ type: t.Literal('text'), text: t.String() });

export const tTool = t.Object({
    name: t.String(),
    description: t.Optional(t.String()),
    input_schema: t.Record(t.String(), tAny)
});

export const tMessagesRequest = t.Object({
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
export type MessagesRequest = Static<typeof tMessagesRequest> & { originalModel?: string }; // Augment type

export const tTokenCountRequest = t.Object({
    model: t.String(),
    messages: t.Array(tMessage),
    system: t.Optional(t.Union([t.String(), t.Array(tSystemContent)])),
    tools: t.Optional(t.Array(tTool)),
});
export type TokenCountRequest = Static<typeof tTokenCountRequest> & { originalModel?: string };