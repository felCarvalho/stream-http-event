export type DeepSeekReasonEffort = "high" | "max";

export interface DeepSeekThink {
    type: "enabled" | "disabled";
    reasoning_effort?: DeepSeekReasonEffort;
}

export class DeepSeekThinkingBuilder {
    private typeValue: "enabled" | "disabled" = "enabled";
    private reasoningEffortValue?: DeepSeekReasonEffort;

    type(type: "enabled" | "disabled"): this {
        this.typeValue = type;
        return this;
    }

    reasoningEffort(effort: DeepSeekReasonEffort): this {
        this.reasoningEffortValue = effort;
        return this;
    }

    build(): DeepSeekThink {
        const thinking: DeepSeekThink = { type: this.typeValue };
        if (this.reasoningEffortValue !== undefined)
            thinking.reasoning_effort = this.reasoningEffortValue;
        return thinking;
    }
}
