import type { DeepSeekResponseFormat } from "../../types-providers/types.deepseek.js";

export class DeepSeekResponseFormatBuilder {
    private typeValue: DeepSeekResponseFormat["type"] = "text";

    type(type: DeepSeekResponseFormat["type"]): this {
        this.typeValue = type;
        return this;
    }

    build(): DeepSeekResponseFormat {
        return { type: this.typeValue };
    }
}
