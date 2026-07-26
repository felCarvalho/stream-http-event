export interface DeepSeekResponseFmt {
    type: "text" | "json_object";
}

export class DeepSeekResponseFormatBuilder {
    private typeValue: "text" | "json_object" = "text";

    type(type: "text" | "json_object"): this {
        this.typeValue = type;
        return this;
    }

    build(): DeepSeekResponseFmt {
        return { type: this.typeValue };
    }
}
