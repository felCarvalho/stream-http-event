interface DeepSeekHeaders<apiKey extends string> {
    method: "POST";
    hostname: "api.deepseek.com";
    path: "/chat/completions";
    headers: {
        "Content-Type": "application/json";
        Accept: "application/json";
        Authorization: `Bearer ${apiKey}`;
    };
    maxRedirects: 20;
}

interface DeepSeekMessage {
    content: string;
    role: "system" | "user" | "assistant" | "tool";
}

export type DeepSeekModel = "deepseek-v4-pro" | "deepseek-v4-flash";

export interface DeepSeekThinkingType {
    type: "enabled" | "disabled";
}

export type DeepSeekReasoningEffort = "high" | "max";

export interface DeepSeekResponseFormat {
    type: "text" | "object";
}

export interface DeepSeekParamatersTools {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
}

export interface DeepSeekTools {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: DeepSeekParamatersTools;
    };
    strict: boolean;
}

export interface DeepSeekBody {
    messages: DeepSeekMessage[];
    model: DeepSeekModel;
    thinking: DeepSeekThinkingType;
    reasoning_effort: DeepSeekReasoningEffort;
    max_tokens: number;
    response_format: DeepSeekResponseFormat;
    stop: null;
    stream: number;
    stream_options: null;
    temperature: 1;
    top_p: 1;
    tools: DeepSeekTools[];
    tool_choice: "none" | "auto" | "required";
    logprobs: false;
    top_logprobs: null;
    user_id: string;
}
