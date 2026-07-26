export type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro";

export type DeepSeekReasoningEffort = "high" | "max";

export type DeepSeekHeaders = Record<string, string>;

export interface DeepSeekMessage {
    content: string;
    role: "system" | "user" | "assistant" | "tool";
    name?: string;
    tool_call_id?: string;
    prefix?: boolean;
    reasoning_content?: string | null;
}

export interface DeepSeekThinking {
    type: "enabled" | "disabled";
    reasoning_effort?: DeepSeekReasoningEffort;
}

export interface DeepSeekResponseFormat {
    type: "text" | "json_object";
}

export interface DeepSeekToolParameters {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
}

export interface DeepSeekTool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters?: DeepSeekToolParameters;
    };
    strict: boolean;
}

export interface DeepSeekRequestBody {
    messages: DeepSeekMessage[];
    model: DeepSeekModel;
    thinking?: DeepSeekThinking | null;
    max_tokens?: number | null;
    response_format?: DeepSeekResponseFormat | null;
    stop?: string | string[] | null;
    stream?: boolean | null;
    stream_options?: { include_usage: boolean } | null;
    temperature?: number | null;
    top_p?: number | null;
    tools?: DeepSeekTool[] | null;
    tool_choice?:
        | "none"
        | "auto"
        | "required"
        | { type: "function"; function: { name: string } }
        | null;
    logprobs?: boolean | null;
    top_logprobs?: number | null;
    user_id?: string | null;
}
