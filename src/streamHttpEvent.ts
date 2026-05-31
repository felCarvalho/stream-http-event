import type {
    dataFetchType,
    serializeType,
    timeoutType,
    streamIaType,
    FetchOptions,
    extractorType,
} from "./type.js";

export class StreamHttpEvent {
    private url?: string;
    private headers?: Record<string, string> = {};
    private timeOut?: number;
    private extractor?: extractorType[];

    public dataFetch({ url, headers, timeOut, extractor }: dataFetchType) {
        this.url = url;
        this.headers = headers ?? {};
        this.timeOut = timeOut;
        this.extractor = extractor;
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

    private async timeout({ controller, timeOutId, bodyReader }: timeoutType) {
        if (timeOutId.getTime()) {
            timeOutId.clearTime();
        }

        if (this.timeOut) {
            timeOutId.setTime({
                id: setTimeout(async () => {
                    try {
                        await bodyReader.cancel();
                    } catch (error) {
                        console.error(error);
                    }
                    try {
                        controller.error(
                            new Error(
                                `Ops, Seu provedor de IA demorou mais de ${this.timeOut}ms`,
                            ),
                        );
                    } catch (error) {
                        console.error(error);
                    }
                }, this.timeOut),
            });
        }
    }

    private serialize({
        buffer,
        controller,
        encoder,
        extractor,
        encodeBytes,
        state,
    }: serializeType) {
        const lines = buffer.getBuffer().split("\n");
        buffer.setBuffer(lines.pop() ?? "");

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine) continue;

            if (trimmedLine === "data: [DONE]") {
                try {
                    controller.close();
                } catch (error) {
                    console.error(error);
                }
                return true;
            }

            if (trimmedLine.startsWith("data:")) {
                const cleanData = trimmedLine.slice("data:".length).trim();

                if (cleanData) {
                    let parsedData;

                    try {
                        parsedData = JSON.parse(cleanData);
                    } catch (error) {
                        console.error(error);
                        state.clearState();
                        continue;
                    }
                    let extractedState;

                    if (extractor) {
                        for (const fn of extractor) {
                            state.setState(fn.fn(parsedData));

                            if (state.hasStateByKey(fn.key)) {
                                extractedState = state.getState();
                            }
                        }
                    }

                    if (encodeBytes) {
                        const stringFy = JSON.stringify(
                            extractedState ?? parsedData,
                        );
                        controller.enqueue(encoder.encode(stringFy + "\n"));
                    } else {
                        controller.enqueue(extractedState ?? parsedData);
                    }
                }

                state.clearState();
            }
        }

        return false;
    }

    private streamIA({ body, encodeBytes, extractor }: streamIaType) {
        const bodyReader = body.getReader();
        const buffer = this.bufferControl();
        const timeOutId = this.timeOutControl();
        const state = this.stateLocal();
        const decoder: TextDecoder = new TextDecoder();
        const encoder: TextEncoder = new TextEncoder();

        return new ReadableStream({
            start: async (controller) => {
                this.timeout({ controller, timeOutId, bodyReader });

                try {
                    while (true) {
                        const { value, done } = await bodyReader.read();

                        if (done) {
                            timeOutId.clearTime();
                            try {
                                controller.close();
                            } catch (error) {
                                console.error(error);
                            }
                            break;
                        }

                        if (!value) {
                            throw new Error(
                                "Não foi encontrado valor codificado na stream",
                            );
                        }

                        buffer.add(
                            decoder.decode(value, {
                                stream: true,
                            }),
                        );

                        this.timeout({ controller, timeOutId, bodyReader });

                        const isDone = this.serialize({
                            buffer,
                            controller,
                            encoder,
                            extractor,
                            encodeBytes,
                            state,
                        });
                        if (isDone) {
                            timeOutId.clearTime();
                            break;
                        }
                    }
                } catch (error) {
                    timeOutId.clearTime();
                    try {
                        controller.error(error);
                    } catch {
                        console.error(error);
                    }
                } finally {
                    try {
                        await bodyReader.cancel();
                        bodyReader.releaseLock();
                    } catch (error) {
                        console.error(error);
                    }
                }
            },
        });
    }

    public async fetchIA({
        encodeBytes,
        signal,
        method,
        body,
        extractor,
    }: FetchOptions) {
        if (!this.url) {
            throw new Error("dataFetch() precisa da url do seu provedor de IA");
        }

        const fetcher = await fetch(this.url, {
            method: method ?? "POST",
            headers: this.headers,
            body: body ?? undefined,
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
                encodeBytes,
                extractor: extractor ?? this.extractor,
            }) as ReadableStream;
        } else {
            return await fetcher.json();
        }
    }
}
