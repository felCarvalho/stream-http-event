export interface DeepSeekToolParam {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
}

export class DeepSeekToolParametersBuilder {
    private propertiesValue: Record<string, unknown> = {};
    private requiredValue: string[] = [];

    property(name: string, schema: unknown): this {
        this.propertiesValue[name] = schema;
        return this;
    }

    required(...names: string[]): this {
        this.requiredValue.push(...names);
        return this;
    }

    build(): DeepSeekToolParam {
        return {
            type: "object",
            properties: this.propertiesValue,
            required: this.requiredValue,
        };
    }
}
