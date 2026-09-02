import type {
    Messages,
    Modelo,
    CacheControlEphemeral,
    FormatResponse,
    ThinkingConfigParam,
    TextBlockParam,
    ToolChoice,
    AnthropicToolUnion,
} from "../../types-providers/types.anthropic.js";

export interface AnthropicBody {
    max_tokens: number;
    messages: Messages[];
    model: Modelo;
    system?: string | TextBlockParam[];
    thinking?: ThinkingConfigParam;
    cache_control?: CacheControlEphemeral | null;
    container?: string | null;
    inference_geo?: string | null;
    metadata?: {
        user_id?: string | null;
    };
    output_config?: FormatResponse;
    service_tier?: "auto" | "standard_only";
    stop_sequences?: string[];
    stream?: boolean;
    tools?: AnthropicToolUnion[];
    tool_choice?: ToolChoice;
    user_profile_id?: string;
}

export class AnthropicBodyBuilder {
    private messagesValue: Messages[] = [];
    private modelValue: Modelo = "claude-sonnet-4-20250514";
    private maxTokensValue: number = 1024;
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
    private toolsValue: AnthropicToolUnion[] = [];
    private toolChoiceValue?: ToolChoice;
    private userProfileIdValue?: string;

    messages(messages: Messages[]): this {
        this.messagesValue = messages;
        return this;
    }

    model(model: Modelo): this {
        this.modelValue = model;
        return this;
    }

    maxTokens(maxTokens: number): this {
        this.maxTokensValue = maxTokens;
        return this;
    }

    system(system: string | TextBlockParam[]): this {
        this.systemValue = system;
        return this;
    }

    thinking(thinking: ThinkingConfigParam): this {
        this.thinkingValue = thinking;
        return this;
    }

    cacheControl(cacheControl: CacheControlEphemeral): this {
        this.cacheControlValue = cacheControl;
        return this;
    }

    container(container: string): this {
        this.containerValue = container;
        return this;
    }

    inferenceGeo(geo: string): this {
        this.inferenceGeoValue = geo;
        return this;
    }

    metadata(metadata: { user_id?: string | null }): this {
        this.metadataValue = metadata;
        return this;
    }

    outputConfig(config: FormatResponse): this {
        this.outputConfigValue = config;
        return this;
    }

    serviceTier(tier: "auto" | "standard_only"): this {
        this.serviceTierValue = tier;
        return this;
    }

    stopSequences(sequences: string[]): this {
        this.stopSequencesValue = sequences;
        return this;
    }

    stream(stream: boolean): this {
        this.streamValue = stream;
        return this;
    }

    tools(tools: AnthropicToolUnion[]): this {
        this.toolsValue = tools;
        return this;
    }

    toolChoice(choice: ToolChoice): this {
        this.toolChoiceValue = choice;
        return this;
    }

    userProfileId(id: string): this {
        this.userProfileIdValue = id;
        return this;
    }

    build(): AnthropicBody {
        const body: AnthropicBody = {
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
        if (this.toolsValue.length) body.tools = this.toolsValue;
        if (this.toolChoiceValue !== undefined)
            body.tool_choice = this.toolChoiceValue;
        if (this.userProfileIdValue !== undefined)
            body.user_profile_id = this.userProfileIdValue;
        return body;
    }
}
