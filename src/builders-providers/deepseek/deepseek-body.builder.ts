import type {
    DeepSeekRequestBody,
    DeepSeekTool,
    DeepSeekMessage,
    DeepSeekThinking,
    DeepSeekResponseFormat,
} from "../../types-providers/types.deepseek.js";

export class DeepSeekBodyBuilder {
    private messagesValue: DeepSeekRequestBody["messages"] = [];
    private modelValue: DeepSeekRequestBody["model"] = "deepseek-v4-pro";
    private thinkingValue?: DeepSeekThinking | null;
    private maxTokensValue?: number | null;
    private responseFormatValue?: DeepSeekResponseFormat | null;
    private stopValue?: string | string[] | null;
    private streamValue?: boolean | null;
    private streamOptionsValue?: { include_usage: boolean } | null;
    private temperatureValue?: number | null;
    private topPValue?: number | null;
    private toolsValue: DeepSeekTool[] = [];
    private toolChoiceValue?: NonNullable<DeepSeekRequestBody["tool_choice"]>;
    private logprobsValue?: boolean | null;
    private topLogprobsValue?: number | null;
    private userIdValue?: string | null;

    messages(messages: DeepSeekRequestBody["messages"]): this {
        this.messagesValue = messages;
        return this;
    }

    model(model: DeepSeekRequestBody["model"]): this {
        this.modelValue = model;
        return this;
    }

    thinking(thinking: NonNullable<DeepSeekRequestBody["thinking"]>): this {
        this.thinkingValue = thinking;
        return this;
    }

    maxTokens(maxTokens: NonNullable<DeepSeekRequestBody["max_tokens"]>): this {
        this.maxTokensValue = maxTokens;
        return this;
    }

    responseFormat(
        format: NonNullable<DeepSeekRequestBody["response_format"]>,
    ): this {
        this.responseFormatValue = format;
        return this;
    }

    stop(stop: NonNullable<DeepSeekRequestBody["stop"]>): this {
        this.stopValue = stop;
        return this;
    }

    stream(stream: NonNullable<DeepSeekRequestBody["stream"]>): this {
        this.streamValue = stream;
        return this;
    }

    streamOptions(
        options: NonNullable<DeepSeekRequestBody["stream_options"]>,
    ): this {
        this.streamOptionsValue = options;
        return this;
    }

    temperature(
        temperature: NonNullable<DeepSeekRequestBody["temperature"]>,
    ): this {
        this.temperatureValue = temperature;
        return this;
    }

    topP(topP: NonNullable<DeepSeekRequestBody["top_p"]>): this {
        this.topPValue = topP;
        return this;
    }

    tools(tools: NonNullable<DeepSeekRequestBody["tools"]>): this {
        this.toolsValue = tools;
        return this;
    }

    toolChoice(choice: NonNullable<DeepSeekRequestBody["tool_choice"]>): this {
        this.toolChoiceValue = choice;
        return this;
    }

    logprobs(logprobs: NonNullable<DeepSeekRequestBody["logprobs"]>): this {
        this.logprobsValue = logprobs;
        return this;
    }

    topLogprobs(
        topLogprobs: NonNullable<DeepSeekRequestBody["top_logprobs"]>,
    ): this {
        this.topLogprobsValue = topLogprobs;
        return this;
    }

    userId(userId: NonNullable<DeepSeekRequestBody["user_id"]>): this {
        this.userIdValue = userId;
        return this;
    }

    build(): DeepSeekRequestBody {
        const body: DeepSeekRequestBody = {
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
