import type {
    DeepSeekModel,
    DeepSeekTool,
    DeepSeekMessage,
    DeepSeekThinking,
    DeepSeekResponseFormat,
} from "../../types-providers/types.deepseek.js";

export interface DeepSeekBody {
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

export class DeepSeekBodyBuilder {
    private messagesValue: DeepSeekMessage[] = [];
    private modelValue: DeepSeekModel = "deepseek-v4-pro";
    private thinkingValue?: DeepSeekThinking | null;
    private maxTokensValue?: number | null;
    private responseFormatValue?: DeepSeekResponseFormat | null;
    private stopValue?: string | string[] | null;
    private streamValue?: boolean | null;
    private streamOptionsValue?: { include_usage: boolean } | null;
    private temperatureValue?: number | null;
    private topPValue?: number | null;
    private toolsValue: DeepSeekTool[] = [];
    private toolChoiceValue?:
        | "none"
        | "auto"
        | "required"
        | { type: "function"; function: { name: string } };
    private logprobsValue?: boolean | null;
    private topLogprobsValue?: number | null;
    private userIdValue?: string | null;

    messages(messages: DeepSeekMessage[]): this {
        this.messagesValue = messages;
        return this;
    }

    model(model: DeepSeekModel): this {
        this.modelValue = model;
        return this;
    }

    thinking(thinking: DeepSeekThinking): this {
        this.thinkingValue = thinking;
        return this;
    }

    maxTokens(maxTokens: number): this {
        this.maxTokensValue = maxTokens;
        return this;
    }

    responseFormat(format: DeepSeekResponseFormat): this {
        this.responseFormatValue = format;
        return this;
    }

    stop(stop: string | string[]): this {
        this.stopValue = stop;
        return this;
    }

    stream(stream: boolean): this {
        this.streamValue = stream;
        return this;
    }

    streamOptions(options: { include_usage: boolean }): this {
        this.streamOptionsValue = options;
        return this;
    }

    temperature(temperature: number): this {
        this.temperatureValue = temperature;
        return this;
    }

    topP(topP: number): this {
        this.topPValue = topP;
        return this;
    }

    tools(tools: DeepSeekTool[]): this {
        this.toolsValue = tools;
        return this;
    }

    toolChoice(
        choice:
            | "none"
            | "auto"
            | "required"
            | { type: "function"; function: { name: string } },
    ): this {
        this.toolChoiceValue = choice;
        return this;
    }

    logprobs(logprobs: boolean): this {
        this.logprobsValue = logprobs;
        return this;
    }

    topLogprobs(topLogprobs: number): this {
        this.topLogprobsValue = topLogprobs;
        return this;
    }

    userId(userId: string): this {
        this.userIdValue = userId;
        return this;
    }

    build(): DeepSeekBody {
        const body: DeepSeekBody = {
            messages: this.messagesValue,
            model: this.modelValue,
        };
        if (this.thinkingValue !== undefined)
            body.thinking = this.thinkingValue;
        if (this.maxTokensValue !== undefined)
            body.max_tokens = this.maxTokensValue;
        if (this.responseFormatValue !== undefined)
            body.response_format = this.responseFormatValue;
        if (this.stopValue !== undefined) body.stop = this.stopValue;
        if (this.streamValue !== undefined) body.stream = this.streamValue;
        if (this.streamOptionsValue !== undefined)
            body.stream_options = this.streamOptionsValue;
        if (this.temperatureValue !== undefined)
            body.temperature = this.temperatureValue;
        if (this.topPValue !== undefined) body.top_p = this.topPValue;
        if (this.toolsValue.length) body.tools = this.toolsValue;
        if (this.toolChoiceValue !== undefined)
            body.tool_choice = this.toolChoiceValue;
        if (this.logprobsValue !== undefined)
            body.logprobs = this.logprobsValue;
        if (this.topLogprobsValue !== undefined)
            body.top_logprobs = this.topLogprobsValue;
        if (this.userIdValue !== undefined) body.user_id = this.userIdValue;
        return body;
    }
}
