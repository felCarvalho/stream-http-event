import type { ThinkingConfigParam } from "../../types-providers/types.anthropic.js";

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

    build(): ThinkingConfigParam {
        if (this.typeValue === "enabled") {
            return {
                type: "enabled",
                budget_tokens: this.budgetTokensValue,
            };
        }
        return { type: "disabled" };
    }
}
