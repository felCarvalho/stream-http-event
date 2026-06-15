import type { DeepSeekMessage } from "../../types-providers/types.deepseek.js";

export class DeepSeekMessageBuilder {
    private roleValue: DeepSeekMessage["role"] = "user";
    private contentValue: DeepSeekMessage["content"] = "";
    private nameValue?: string;
    private toolCallIdValue?: string;
    private prefixValue?: boolean;
    private reasoningContentValue?: string | null;

    role(role: DeepSeekMessage["role"]): this {
        this.roleValue = role;
        return this;
    }

    content(content: DeepSeekMessage["content"]): this {
        this.contentValue = content;
        return this;
    }

    name(name: NonNullable<DeepSeekMessage["name"]>): this {
        this.nameValue = name;
        return this;
    }

    toolCallId(id: NonNullable<DeepSeekMessage["tool_call_id"]>): this {
        this.toolCallIdValue = id;
        return this;
    }

    prefix(prefix: NonNullable<DeepSeekMessage["prefix"]>): this {
        this.prefixValue = prefix;
        return this;
    }

    reasoningContent(
        reasoningContent: NonNullable<DeepSeekMessage["reasoning_content"]>,
    ): this {
        this.reasoningContentValue = reasoningContent;
        return this;
    }

    build(): DeepSeekMessage {
        const msg: DeepSeekMessage = {
            role: this.roleValue,
            content: this.contentValue,
        };
        if (this.nameValue !== undefined) msg.name = this.nameValue;
        if (this.toolCallIdValue !== undefined)
            msg.tool_call_id = this.toolCallIdValue;
        if (this.prefixValue !== undefined) msg.prefix = this.prefixValue;
        if (this.reasoningContentValue !== undefined)
            msg.reasoning_content = this.reasoningContentValue;
        return msg;
    }
}
