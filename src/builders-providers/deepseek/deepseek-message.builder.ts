export interface DeepSeekMessageBuild {
    content: string;
    role: "system" | "user" | "assistant" | "tool";
    name?: string;
    tool_call_id?: string;
    prefix?: boolean;
    reasoning_content?: string | null;
}

export class DeepSeekMessageBuilder {
    private roleValue: "system" | "user" | "assistant" | "tool" = "user";
    private contentValue: string = "";
    private nameValue?: string;
    private toolCallIdValue?: string;
    private prefixValue?: boolean;
    private reasoningContentValue?: string | null;

    role(role: "system" | "user" | "assistant" | "tool"): this {
        this.roleValue = role;
        return this;
    }

    content(content: string): this {
        this.contentValue = content;
        return this;
    }

    name(name: string): this {
        this.nameValue = name;
        return this;
    }

    toolCallId(id: string): this {
        this.toolCallIdValue = id;
        return this;
    }

    prefix(prefix: boolean): this {
        this.prefixValue = prefix;
        return this;
    }

    reasoningContent(reasoningContent: string): this {
        this.reasoningContentValue = reasoningContent;
        return this;
    }

    build(): DeepSeekMessageBuild {
        const msg: DeepSeekMessageBuild = {
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
