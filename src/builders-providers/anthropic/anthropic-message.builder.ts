import type { Messages } from "../../types-providers/types.anthropic.js";

export class AnthropicMessageBuilder {
    private roleValue: Messages["role"] = "user";
    private contentValue: Messages["content"] = "";

    role(role: Messages["role"]): this {
        this.roleValue = role;
        return this;
    }

    content(content: Messages["content"]): this {
        this.contentValue = content;
        return this;
    }

    build(): Messages {
        return {
            role: this.roleValue,
            content: this.contentValue,
        };
    }
}
