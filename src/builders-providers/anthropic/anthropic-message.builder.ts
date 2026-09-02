import type { ContentBlockParam } from "../../types-providers/types.anthropic.js";

export interface AnthropicMessage {
    role: "user" | "assistant" | "system";
    content: string | ContentBlockParam[];
}

export class AnthropicMessageBuilder {
    private roleValue: "user" | "assistant" | "system" = "user";
    private contentValue: string | ContentBlockParam[] = "";

    role(role: "user" | "assistant" | "system"): this {
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
