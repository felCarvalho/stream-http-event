import type {
    DeepSeekThinking,
    DeepSeekReasoningEffort,
} from "../../types-providers/types.deepseek.js";

export class DeepSeekThinkingBuilder {
    private typeValue: DeepSeekThinking["type"] = "enabled";
    private reasoningEffortValue?: DeepSeekReasoningEffort;

    type(type: DeepSeekThinking["type"]): this {
        this.typeValue = type;
        return this;
    }

    reasoningEffort(effort: NonNullable<DeepSeekThinking["reasoning_effort"]>): this {
        this.reasoningEffortValue = effort;
        return this;
    }

    build(): DeepSeekThinking {
        const thinking: DeepSeekThinking = { type: this.typeValue };
        if (this.reasoningEffortValue !== undefined)
            thinking.reasoning_effort = this.reasoningEffortValue;
        return thinking;
    }
}
