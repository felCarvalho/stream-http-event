export interface AnthropicThinkingEnabled {
    type: "enabled";
    budget_tokens: number;
}

export interface AnthropicThinkingDisabled {
    type: "disabled";
}

export type AnthropicThinking =
    | AnthropicThinkingEnabled
    | AnthropicThinkingDisabled;

export class AnthropicThinkingBuilder {
    private typeValue: "enabled" | "disabled" = "enabled";
    private budgetTokensValue = 1024;

    type(type: "enabled" | "disabled"): this {
        this.typeValue = type;
        return this;
    }

    budgetTokens(tokens: number): this {
        this.budgetTokensValue = tokens;
        return this;
    }

    build(): AnthropicThinking {
        if (this.typeValue === "enabled") {
            return {
                type: "enabled",
                budget_tokens: this.budgetTokensValue,
            };
        }
        return { type: "disabled" };
    }
}
