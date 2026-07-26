export interface AnthropicInputSchemaBuild {
    type: "object";
    properties?: Record<string, unknown> | null;
    required?: Array<string> | null;
}

export class AnthropicInputSchemaBuilder {
    private propertiesValue: Record<string, unknown> = {};
    private requiredValue: Array<string> = [];

    property(name: string, schema: unknown): this {
        this.propertiesValue[name] = schema;
        return this;
    }

    required(...names: string[]): this {
        this.requiredValue.push(...names);
        return this;
    }

    build(): AnthropicInputSchemaBuild {
        const schema: AnthropicInputSchemaBuild = {
            type: "object",
            properties: this.propertiesValue,
            required: this.requiredValue,
        };
        return schema;
    }
}
