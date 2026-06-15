import type {
    DeepSeekTool,
    DeepSeekToolParameters,
} from "../../types-providers/types.deepseek.js";

export class DeepSeekToolBuilder {
    private nameValue: DeepSeekTool["function"]["name"] = "";
    private descriptionValue: DeepSeekTool["function"]["description"] = "";
    private parametersValue?: DeepSeekToolParameters;
    private strictValue: DeepSeekTool["strict"] = false;

    name(name: DeepSeekTool["function"]["name"]): this {
        this.nameValue = name;
        return this;
    }

    description(description: DeepSeekTool["function"]["description"]): this {
        this.descriptionValue = description;
        return this;
    }

    parameters(
        parameters: NonNullable<DeepSeekTool["function"]["parameters"]>,
    ): this {
        this.parametersValue = parameters;
        return this;
    }

    strict(strict: DeepSeekTool["strict"]): this {
        this.strictValue = strict;
        return this;
    }

    build(): DeepSeekTool {
        const tool: DeepSeekTool = {
            type: "function",
            function: {
                name: this.nameValue,
                description: this.descriptionValue,
            },
            strict: this.strictValue,
        };
        if (this.parametersValue !== undefined)
            tool.function.parameters = this.parametersValue;
        return tool;
    }
}
