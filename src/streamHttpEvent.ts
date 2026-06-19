import type {
    dataFetchType,
    serializeType,
    timeoutType,
    streamIaType,
    FetchOptions,
    extractorType,
    stateLocalType,
} from "./type.js";
export class StreamHttpEvent {
    private url: string = "";
    private headers: Record<string, string> = {};
    private timeOut?: number;
    private extractor?: extractorType[];
    private onDone?: (finalData: Record<string, unknown>) => void;
    private body?: Record<string, unknown>;

    public dataFetch<
        H extends Record<string, string> = Record<string, string>,
        B extends Record<string, unknown> = Record<string, unknown>,
    >({ url, headers, body, timeOut, extractor, onDone }: dataFetchType<H, B>) {
        this.url = url;
        this.headers = headers ?? ({} as Record<string, string>);
        this.timeOut = timeOut;
        this.extractor = extractor;
        this.onDone = onDone;
        this.body = body;
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

    private parseAndExtracted({
        line,
        state,
        eventName,
        extractor,
    }: {
        line: string;
        state: stateLocalType;
        extractor: extractorType[];
        eventName: "data" | "event";
    }) {
        const clear = line.trim().slice(`${eventName}: `.length);

        if (clear) {
            try {
                eventName === "event" &&
                    state.setState({ event: JSON.parse(clear) });

                eventName === "data" &&
                    state.setState({ data: JSON.parse(clear) });
            } catch (e) {
                throw new Error(
                    `Falha ao armazenar chunks para extração de informações: ${e}`,
                );
            }

            const data = state.getStateOne("data") as Record<string, unknown>;
            const event = state.getStateOne("event");

            if (extractor.length && (data || event)) {
                for (const extItem of extractor) {
                    state.setState({ event: JSON.parse(clear) });
                    state.setState({ data: JSON.parse(clear) });
                }
            }
        }
    }

    private serialize({
        buffer,
        extractor,
        state,
        stateLongDuration,
    }: serializeType) {
        const lines = buffer.getBuffer().split("\n\n");
        buffer.setBuffer(lines.pop() ?? "");

        for (const message of lines) {
            const trimmedEvent = message.trim().split("\n");

            for (const lineForLine of trimmedEvent) {
                if (lineForLine === "data: [DONE]") {
                    return lineForLine;
                }

                if (lineForLine.startsWith("data:")) {
                    this.parseAndExtracted({
                        line: lineForLine,
                        state,
                        extractor: extractor ?? [],
                        eventName: "data",
                    });
                    const data = state.getStateOne("data") as Record<
                        string,
                        unknown
                    >;
                    stateLongDuration.setState({ data });
                }

                if (lineForLine.startsWith("event:")) {
                    this.parseAndExtracted({
                        line: lineForLine,
                        state,
                        extractor: extractor ?? [],
                        eventName: "event",
                    });
                }
            }
        }

        return false;
    }

    private async *streamIA({
        body,
        encodeBytes,
        extractor,
        formatSSE,
    }: streamIaType) {
        const bodyReader = body.getReader();
        const buffer = this.bufferControl();
        const timeOutId = this.timeOutControl();
        const state = this.stateLocal();
        const stateLongDuration = this.stateLocal();
        const decoder: TextDecoder = new TextDecoder();
        const encoder: TextEncoder = new TextEncoder();
        let chunksAcumulated = "";

        try {
            while (true) {
                const { done, value } = await bodyReader.read();

                if (done) {
                    if (chunksAcumulated) {
                        this.onDone
                            ? this.onDone({ chunksAcumulated })
                            : (this.onDone = undefined);
                    }
                    break;
                }

                buffer.add(decoder.decode(value, { stream: true }));

                const serialized = this.serialize({
                    extractor: extractor ?? this.extractor,
                    buffer,
                    state,
                    stateLongDuration,
                });

                this.timeout({ timeOutId, bodyReader });

                if (serialized === "data: [DONE]") {
                    if (chunksAcumulated) {
                        this.onDone
                            ? this.onDone({ chunksAcumulated })
                            : (this.onDone = undefined);
                    }
                    return;
                }

                const extractedData =
                    state.getStateOne("data") ??
                    "nenhum dado foi extraido de data";
                const extractedEvent =
                    state.getStateOne("event") ??
                    "nenhum dado foi extraido de event";
                if (!extractedData) continue;

                let traficChunk = "";

                if (formatSSE) {
                    if (extractedData)
                        traficChunk += `data: ${JSON.stringify(extractedData)}\n`;

                    if (extractedEvent)
                        traficChunk += `event: ${extractedEvent}\n`;

                    if (traficChunk) {
                        traficChunk += "\n";
                        chunksAcumulated += traficChunk;
                    }
                } else {
                    if (extractedData)
                        traficChunk += `${JSON.stringify(extractedData)}\n`;

                    if (extractedEvent) traficChunk += `${extractedEvent}\n`;

                    if (traficChunk) {
                        traficChunk += "\n";
                        chunksAcumulated += traficChunk;
                    }
                }

                if (traficChunk) {
                    yield encodeBytes
                        ? encoder.encode(traficChunk)
                        : traficChunk;
                }

                state.clearStateByKey("data");
                state.clearStateByKey("event");
            }
        } catch (e: unknown) {
            throw e;
        } finally {
            timeOutId.clearTime();
            bodyReader.releaseLock();
        }
    }

    public async fetchIA({
        encodeBytes,
        signal,
        method,
        formatSSE = true,
    }: FetchOptions) {
        if (!this.url) {
            throw new Error("dataFetch() precisa da url do seu provedor de IA");
        }

        const fetcher = await fetch(this.url, {
            method: method ?? "POST",
            headers: this.headers,
            body: this.body ? JSON.stringify(this.body) : undefined,
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
                formatSSE,
                encodeBytes,
                extractor: this.extractor ?? [],
            }) as AsyncGenerator<
                string | Uint8Array<ArrayBuffer>,
                void,
                unknown
            >;
        } else {
            const extractors = this.extractor;
            let data = await fetcher.json();

            if (extractors) {
                for (const extItem of extractors) {
                    data = extItem.fn({ data });
                }
            }

            return data as Promise<Record<string, unknown>>;
        }
    }
}
