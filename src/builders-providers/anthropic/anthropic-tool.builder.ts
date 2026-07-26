import type {
    AnthropicInputSchemaBuild,
} from "./anthropic-inputSchema.builder.js";
import type { CacheControlEphemeral } from "../../types-providers/types.anthropic.js";

export interface AnthropicToolBuild {
    input_schema: AnthropicInputSchemaBuild;
    name: string;
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    description?: string;
    eager_input_streaming?: boolean | null;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
    type?: "custom" | null;
}

export class AnthropicToolBuilder {
    private nameValue: string = "";
    private descriptionValue?: string;
    private inputSchemaValue!: AnthropicInputSchemaBuild;
    private allowedCallersValue?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    private cacheControlValue?: CacheControlEphemeral | null;
    private deferLoadingValue?: boolean;
    private eagerInputStreamingValue?: boolean | null;
    private inputExamplesValue?: Array<Record<string, unknown>>;
    private strictValue?: boolean;
    private typeValue?: "custom" | null;

    name(name: string): this {
        this.nameValue = name;
        return this;
    }

    description(description: string): this {
        this.descriptionValue = description;
        return this;
    }

    inputSchema(schema: AnthropicInputSchemaBuild): this {
        this.inputSchemaValue = schema;
        return this;
    }

    allowedCallers(
        callers: Array<
            | "direct"
            | "code_execution_20250825"
            | "code_execution_20260120"
            | "code_execution_20260521"
        >,
    ): this {
        this.allowedCallersValue = callers;
        return this;
    }

    cacheControl(cacheControl: CacheControlEphemeral): this {
        this.cacheControlValue = cacheControl;
        return this;
    }

    deferLoading(deferLoading: boolean): this {
        this.deferLoadingValue = deferLoading;
        return this;
    }

    eagerInputStreaming(eager: boolean): this {
        this.eagerInputStreamingValue = eager;
        return this;
    }

    inputExamples(examples: Array<Record<string, unknown>>): this {
        this.inputExamplesValue = examples;
        return this;
    }

    strict(strict: boolean): this {
        this.strictValue = strict;
        return this;
    }

    type(type: "custom"): this {
        this.typeValue = type;
        return this;
    }

    build(): AnthropicToolBuild {
        const tool: AnthropicToolBuild = {
            input_schema: this.inputSchemaValue,
            name: this.nameValue,
        };
        if (this.descriptionValue !== undefined)
            tool.description = this.descriptionValue;
        if (this.allowedCallersValue !== undefined)
            tool.allowed_callers = this.allowedCallersValue;
        if (this.cacheControlValue !== undefined)
            tool.cache_control = this.cacheControlValue;
        if (this.deferLoadingValue !== undefined)
            tool.defer_loading = this.deferLoadingValue;
        if (this.eagerInputStreamingValue !== undefined)
            tool.eager_input_streaming = this.eagerInputStreamingValue;
        if (this.inputExamplesValue !== undefined)
            tool.input_examples = this.inputExamplesValue;
        if (this.strictValue !== undefined) tool.strict = this.strictValue;
        if (this.typeValue !== undefined) tool.type = this.typeValue;
        return tool;
    }
}
