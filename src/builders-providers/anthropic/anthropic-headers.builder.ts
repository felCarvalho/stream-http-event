export class AnthropicHeadersBuilder {
    private apiKeyValue = "";
    private versionValue = "2023-06-01";

    apiKey(key: string): this {
        this.apiKeyValue = key;
        return this;
    }

    version(version: string): this {
        this.versionValue = version;
        return this;
    }

    build() {
        return {
            "Content-Type": "application/json",
            "x-api-key": this.apiKeyValue,
            "anthropic-version": this.versionValue,
        } as const;
    }
}
