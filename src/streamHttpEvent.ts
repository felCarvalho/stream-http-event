import type {
    dataFetchType,
    serializeType,
    timeoutType,
    streamIaType,
    FetchOptions,
    stateLocalType,
    ExtractorsType,
    BeforeRequestFn,
} from "./type.js";
export class StreamHttpEvent {
    private url: string = "";
    private headers: Record<string, string> = {};
    private timeOut?: number;
    private onDone?: (finalData: { chunks: Record<string, unknown>[] }) => void;
    private body?: Record<string, unknown>;
    private extractors?: ExtractorsType;
    private beforeRequest?: BeforeRequestFn;

    public dataFetch<
        H extends Record<string, string> = Record<string, string>,
        B extends Record<string, unknown> = Record<string, unknown>,
    >({
        url,
        headers,
        body,
        timeOut,
        onDone,
        extractors,
        beforeRequest,
    }: dataFetchType<H, B>) {
        this.url = url;
        this.headers = headers ?? ({} as Record<string, string>);
        this.timeOut = timeOut;
        this.onDone = onDone;
        this.body = body;
        this.extractors = extractors;
        this.beforeRequest = beforeRequest;
    }

    private stateLocal() {
        const state = new Map<string, unknown>();

        return {
            getState: () => Object.fromEntries(state),
            getStateOne: (key: string) => state.get(key),
            setState: (newState: Record<string, unknown>) => {
                for (const [key, value] of Object.entries(
                    newState as Record<string, unknown>,
                )) {
                    state.set(key, value);
                }
            },
            clearState: () => state.clear(),
            clearStateByKey: (key: string) => state.delete(key),
            hasStateByKey: (key: string) => state.has(key),
        };
    }

    private getValueByPath(obj: Record<string, unknown>, path: string) {
        const keys = path.split(/[\[\]\.]+/).filter(Boolean);
        let current: unknown = obj;
        for (const key of keys) {
            if (current && typeof current === "object") {
                current = (current as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }
        return current;
    }

    private bufferControl() {
        let buffer = "";

        return {
            getBuffer: () => buffer,
            setBuffer: (data: string) => {
                buffer = data;
            },
            add: (data: string) => {
                buffer += data;
            },
        };
    }

    private timeOutControl() {
        let timeOutId: ReturnType<typeof setTimeout> | undefined;
        return {
            getTime: () => timeOutId,
            setTime: ({ id }: { id: ReturnType<typeof setTimeout> }) => {
                timeOutId = id;
            },
            clearTime: () => {
                if (timeOutId) {
                    clearTimeout(timeOutId);
                    timeOutId = undefined;
                }
            },
        };
    }

    private timeout({ timeOutId, bodyReader }: timeoutType) {
        if (timeOutId.getTime()) {
            timeOutId.clearTime();
        }

        if (!this.timeOut) {
            return;
        }

        timeOutId.setTime({
            id: setTimeout(async () => {
                try {
                    await bodyReader.cancel();
                } catch (error) {
                    console.error(error);
                }
            }, this.timeOut),
        });
    }

    private GetValueExtract({
        sseObject,
        state,
    }: {
        sseObject: Record<string, unknown>;
        state: stateLocalType;
    }) {
        const forExtract = this.extractors?.defaultExtract ?? [];

        if (forExtract.length)
            for (const extractValue of forExtract) {
                const value = this.getValueByPath(
                    sseObject,
                    extractValue.forExtract,
                );
                state.setState({
                    [extractValue.key]: value,
                });
            }

        const forConditional = this.extractors?.conditionalxtractor ?? [];

        if (forConditional.length)
            for (const cond of forConditional) {
                const value = this.getValueByPath(sseObject, cond.path);
                if (value === cond.condition) {
                    state.setState({ [cond.key]: value as string });
                }
            }
    }

    private serialize({ buffer, state }: serializeType) {
        const lines = buffer.getBuffer().split("\n\n");
        buffer.setBuffer(lines.pop() ?? "");

        for (const message of lines) {
            const trimmedEvent = message.trim().split("\n");
            let sseObject: Record<string, unknown> = {};

            for (const line of trimmedEvent) {
                if (line === "data: [DONE]") {
                    return line;
                }

                if (line.startsWith("data: ")) {
                    sseObject = {
                        data: JSON.parse(line.slice("data: ".length)),
                    };
                }

                if (line.startsWith("event: ")) {
                    sseObject = {
                        ...sseObject,
                        event: line.slice("event: ".length),
                    };
                }

                this.GetValueExtract({ sseObject, state });
            }
        }

        return false;
    }

    private async *streamIA({ body, encodeBytes, prefixKeys }: streamIaType) {
        const bodyReader = body.getReader();
        const buffer = this.bufferControl();
        const timeOutId = this.timeOutControl();
        const state = this.stateLocal();
        const decoder: TextDecoder = new TextDecoder();
        const encoder: TextEncoder = new TextEncoder();
        let chunksAcumulated: Record<string, unknown>[] = [];

        try {
            while (true) {
                const { done, value } = await bodyReader.read();

                if (done) {
                    if (chunksAcumulated.length) {
                        this.onDone
                            ? this.onDone({ chunks: chunksAcumulated })
                            : (this.onDone = undefined);
                    }
                    break;
                }

                buffer.add(decoder.decode(value, { stream: true }));

                const serialized = this.serialize({
                    buffer,
                    state,
                });

                this.timeout({ timeOutId, bodyReader });

                if (serialized === "data: [DONE]") {
                    if (chunksAcumulated.length) {
                        this.onDone
                            ? this.onDone({ chunks: chunksAcumulated })
                            : (this.onDone = undefined);
                    }
                    return;
                }

                const defaultKeys =
                    this.extractors?.defaultExtract?.map((e) => e.key) ?? [];
                const conditionalKeys =
                    this.extractors?.conditionalxtractor?.map((c) => c.key) ??
                    [];

                const extractorKeys = [...defaultKeys, ...conditionalKeys];

                const extractedValues: Record<string, unknown> = {};
                let hasValue = false;
                for (const key of extractorKeys) {
                    const value = state.getStateOne(key);
                    if (value !== undefined) {
                        extractedValues[key] = value;
                        hasValue = true;
                    }
                }

                if (!hasValue) continue;

                chunksAcumulated.push(extractedValues);

                /*let traficChunk = "";

                if (prefixKeys) {
                    for (const [key, value] of Object.entries(
                        extractedValues,
                    )) {
                        const strValue =
                            typeof value === "string"
                                ? value
                                : JSON.stringify(value);
                        traficChunk += `${key}: ${strValue}\n`;
                    }
                } else {
                    for (const [, value] of Object.entries(extractedValues)) {
                        const strValue =
                            typeof value === "string"
                                ? value
                                : JSON.stringify(value);
                        traficChunk += `${strValue}\n`;
                    }
                    }*/

                if (extractedValues) {
                    const valuetrafick =
                        JSON.stringify(extractedValues) + "\n\n";
                    yield encodeBytes
                        ? encoder.encode(`data: ${valuetrafick}`)
                        : `data: ${valuetrafick}`;
                }

                state.clearState();
            }
        } finally {
            timeOutId.clearTime();
            bodyReader.releaseLock();
        }
    }

    public async fetchIA({
        encodeBytes,
        signal,
        method,
        prefixKeys = true,
    }: FetchOptions) {
        if (!this.url) {
            throw new Error("dataFetch() precisa da url do seu provedor de IA");
        }

        let url = this.url;
        let headers = this.headers;
        let body = this.body;

        if (this.beforeRequest) {
            const result = await this.beforeRequest({ url, headers, body });
            if (result) {
                url = result.url ?? url;
                headers = result.headers ?? headers;
                body = result.body ?? body;
            }
        }

        const fetcher = await fetch(url, {
            method: method ?? "POST",
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: signal,
        });

        if (!fetcher.ok) {
            throw new Error(`${fetcher.status} - ${fetcher.statusText}`);
        }

        if (!fetcher.body) {
            throw new Error("Ops, nenhum corpo de resposta na sua requisição");
        }

        const contentType = fetcher.headers.get("content-type") ?? "";

        if (contentType?.includes("text/event-stream")) {
            return this.streamIA({
                body: fetcher.body,
                prefixKeys,
                encodeBytes,
            }) as AsyncGenerator<
                string | Uint8Array<ArrayBuffer>,
                void,
                unknown
            >;
        } else {
            return fetcher.json();
        }
    }
}
