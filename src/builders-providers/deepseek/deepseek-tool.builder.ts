import type { DeepSeekToolParameters } from "../../types-providers/types.deepseek.js";

export interface DeepSeekToolBuild {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters?: DeepSeekToolParameters;
    };
    strict: boolean;
}

export class DeepSeekToolBuilder {
    private nameValue: string = "";
    private descriptionValue: string = "";
    private parametersValue?: DeepSeekToolParameters;
    private strictValue: boolean = false;

    name(name: string): this {
        this.nameValue = name;
        return this;
    }

    description(description: string): this {
        this.descriptionValue = description;
        return this;
    }

    parameters(parameters: DeepSeekToolParameters): this {
        this.parametersValue = parameters;
        return this;
    }

    strict(strict: boolean): this {
        this.strictValue = strict;
        return this;
    }

    build(): DeepSeekToolBuild {
        const tool: DeepSeekToolBuild = {
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
