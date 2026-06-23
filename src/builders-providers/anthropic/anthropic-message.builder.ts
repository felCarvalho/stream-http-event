import type { ContentBlockParam } from "../../types-providers/types.anthropic.js";

export interface AnthropicMessage {
    role: "user" | "assistant";
    content: string | ContentBlockParam[];
}

export class AnthropicMessageBuilder {
    private roleValue: "user" | "assistant" = "user";
    private contentValue: string | ContentBlockParam[] = "";

    role(role: "user" | "assistant"): this {
        this.roleValue = role;
        return this;
    }

    content(content: string | ContentBlockParam[]): this {
        this.contentValue = content;
        return this;
    }

    build(): AnthropicMessage {
        return {
            role: this.roleValue,
            content: this.contentValue,
        };
    }
}
