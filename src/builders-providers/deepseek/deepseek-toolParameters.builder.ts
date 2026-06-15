import type { DeepSeekToolParameters } from "../../types-providers/types.deepseek.js";

export class DeepSeekToolParametersBuilder {
    private propertiesValue: DeepSeekToolParameters["properties"] = {};
    private requiredValue: DeepSeekToolParameters["required"] = [];

    property(
        name: string,
        schema: DeepSeekToolParameters["properties"][string],
    ): this {
        this.propertiesValue[name] = schema;
        return this;
    }

    required(...names: DeepSeekToolParameters["required"]): this {
        this.requiredValue.push(...names);
        return this;
    }

    build(): DeepSeekToolParameters {
        return {
            type: "object",
            properties: this.propertiesValue,
            required: this.requiredValue,
        };
    }
}
