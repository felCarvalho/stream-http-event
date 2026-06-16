import type {
    MessageCreateParamsBase,
    CacheControlEphemeral,
    FormatResponse,
    ThinkingConfigParam,
    TextBlockParam,
} from "../../types-providers/types.anthropic.js";

export class AnthropicBodyBuilder {
    private messagesValue: MessageCreateParamsBase["messages"] = [];
    private modelValue: MessageCreateParamsBase["model"] =
        "claude-sonnet-4-20250514";
    private maxTokensValue: MessageCreateParamsBase["max_tokens"] = 1024;
    private systemValue?: string | TextBlockParam[];
    private thinkingValue?: ThinkingConfigParam;
    private cacheControlValue?: CacheControlEphemeral | null;
    private containerValue?: string | null;
    private inferenceGeoValue?: string | null;
    private metadataValue?: { user_id?: string | null };
    private outputConfigValue?: FormatResponse;
    private serviceTierValue?: "auto" | "standard_only";
    private stopSequencesValue?: string[];
    private streamValue?: boolean;

    messages(messages: MessageCreateParamsBase["messages"]): this {
        this.messagesValue = messages;
        return this;
    }

    model(model: MessageCreateParamsBase["model"]): this {
        this.modelValue = model;
        return this;
    }

    maxTokens(maxTokens: MessageCreateParamsBase["max_tokens"]): this {
        this.maxTokensValue = maxTokens;
        return this;
    }

    system(system: NonNullable<MessageCreateParamsBase["system"]>): this {
        this.systemValue = system;
        return this;
    }

    thinking(
        thinking: NonNullable<MessageCreateParamsBase["thinking"]>,
    ): this {
        this.thinkingValue = thinking;
        return this;
    }

    cacheControl(
        cacheControl: NonNullable<MessageCreateParamsBase["cache_control"]>,
    ): this {
        this.cacheControlValue = cacheControl;
        return this;
    }

    container(
        container: NonNullable<MessageCreateParamsBase["container"]>,
    ): this {
        this.containerValue = container;
        return this;
    }

    inferenceGeo(
        geo: NonNullable<MessageCreateParamsBase["inference_geo"]>,
    ): this {
        this.inferenceGeoValue = geo;
        return this;
    }

    metadata(
        metadata: NonNullable<MessageCreateParamsBase["metadata"]>,
    ): this {
        this.metadataValue = metadata;
        return this;
    }

    outputConfig(
        config: NonNullable<MessageCreateParamsBase["output_config"]>,
    ): this {
        this.outputConfigValue = config;
        return this;
    }

    serviceTier(
        tier: NonNullable<MessageCreateParamsBase["service_tier"]>,
    ): this {
        this.serviceTierValue = tier;
        return this;
    }

    stopSequences(
        sequences: NonNullable<MessageCreateParamsBase["stop_sequences"]>,
    ): this {
        this.stopSequencesValue = sequences;
        return this;
    }

    stream(stream: NonNullable<MessageCreateParamsBase["stream"]>): this {
        this.streamValue = stream;
        return this;
    }

    build(): MessageCreateParamsBase {
        const body: MessageCreateParamsBase = {
            max_tokens: this.maxTokensValue,
            messages: this.messagesValue,
            model: this.modelValue,
        };
        if (this.systemValue !== undefined) body.system = this.systemValue;
        if (this.thinkingValue !== undefined)
            body.thinking = this.thinkingValue;
        if (this.cacheControlValue !== undefined)
            body.cache_control = this.cacheControlValue;
        if (this.containerValue !== undefined)
            body.container = this.containerValue;
        if (this.inferenceGeoValue !== undefined)
            body.inference_geo = this.inferenceGeoValue;
        if (this.metadataValue !== undefined)
            body.metadata = this.metadataValue;
        if (this.outputConfigValue !== undefined)
            body.output_config = this.outputConfigValue;
        if (this.serviceTierValue !== undefined)
            body.service_tier = this.serviceTierValue;
        if (this.stopSequencesValue !== undefined)
            body.stop_sequences = this.stopSequencesValue;
        if (this.streamValue !== undefined) body.stream = this.streamValue;
        return body;
    }
}
