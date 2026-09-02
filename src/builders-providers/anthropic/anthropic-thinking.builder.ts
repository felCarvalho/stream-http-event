export interface AnthropicThinkingEnabled {
    type: "enabled";
    budget_tokens: number;
    display?: "summarized" | "omitted";
}

export interface AnthropicThinkingDisabled {
    type: "disabled";
}

export interface AnthropicThinkingAdaptive {
    type: "adaptive";
    display: "summarized" | "omitted";
}

export type AnthropicThinking =
    | AnthropicThinkingEnabled
    | AnthropicThinkingDisabled
    | AnthropicThinkingAdaptive;

export class AnthropicThinkingBuilder {
    private typeValue: "enabled" | "disabled" | "adaptive" = "enabled";
    private budgetTokensValue = 1024;
    private displayValue?: "summarized" | "omitted";

    type(type: "enabled" | "disabled" | "adaptive"): this {
        this.typeValue = type;
        return this;
    }

    budgetTokens(tokens: number): this {
        this.budgetTokensValue = tokens;
        return this;
    }

    display(display: "summarized" | "omitted"): this {
        this.displayValue = display;
        return this;
    }

    build(): AnthropicThinking {
        if (this.typeValue === "enabled") {
            const result: AnthropicThinkingEnabled = {
                type: "enabled",
                budget_tokens: this.budgetTokensValue,
            };
            if (this.displayValue !== undefined)
                result.display = this.displayValue;
            return result;
        }
        if (this.typeValue === "adaptive") {
            return {
                type: "adaptive",
                display: this.displayValue ?? "summarized",
            };
        }
        return { type: "disabled" };
    }
}
