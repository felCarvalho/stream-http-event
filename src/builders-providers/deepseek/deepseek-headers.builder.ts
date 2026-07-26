export class DeepSeekHeadersBuilder {
    private apiKeyValue = "";

    apiKey(key: string): this {
        this.apiKeyValue = key;
        return this;
    }

    build() {
        return {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${this.apiKeyValue}`,
        } as const;
    }
}
