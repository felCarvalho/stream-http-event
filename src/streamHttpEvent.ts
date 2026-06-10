import type {
    dataFetchType,
    serializeType,
    timeoutType,
    streamIaType,
    FetchOptions,
    extractorType,
    stateLocalType,
} from "./type.js";

export class StreamHttpEvent<TData extends object, TEvent = unknown> {
    private url: string = "";
    private headers: Record<string, string> = {};
    private timeOut?: number;
    private extractor?: extractorType<TData, TEvent>[];
    private onDone?: (finalData: Record<string, unknown>) => void;

    public dataFetch({
        url,
        headers,
        timeOut,
        extractor,
        onDone,
    }: dataFetchType<TData, TEvent>) {
        this.url = url;
        this.headers = headers ?? {};
        this.timeOut = timeOut;
        this.extractor = extractor;
        this.onDone = onDone;
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

    private timeout({ controller, timeOutId, bodyReader }: timeoutType) {
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
                try {
                    controller.error(
                        new Error(
                            `Ops, Seu provedor de IA demorou mais de ${this.timeOut}ms`,
                        ),
                    );
                } catch (error) {
                    console.error(
                        `Ops, erro ao enviar error pelo controller de timeout: ${error}`,
                    );
                }
            }, this.timeOut),
        });
    }

    private parseAndExtracted<TData extends object, TEvent = unknown>({
        line,
        state,
        eventName,
        extractor,
    }: {
        line: string;
        state: stateLocalType;
        extractor: extractorType<TData, TEvent>[];
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

            const data = state.getStateOne("data") as TData;
            const event = state.getStateOne("event") as TEvent;

            if (extractor.length && (data || event)) {
                for (const extItem of extractor) {
                    state.setState({
                        extracted: extItem.fn({
                            data,
                            event,
                        }),
                    });
                }
            }
        }
    }

    private serialize({
        buffer,
        controller,
        encoder,
        extractor,
        encodeBytes,
        state,
        stateLongDuration,
    }: serializeType<TData, TEvent>) {
        const lines = buffer.getBuffer().split("\n");
        buffer.setBuffer(lines.pop() ?? "");

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === "data: [DONE]") {
                try {
                    controller.close();
                } catch (error) {
                    throw new Error(`Erro ao fechar o controller: ${error}`);
                }
                return true;
            }

            if (trimmed.startsWith("data:")) {
                this.parseAndExtracted({
                    line: trimmed,
                    state,
                    extractor: extractor ?? [],
                    eventName: "data",
                });
                const data = state.getStateOne("data") as TData;
                stateLongDuration.setState({ data });
            }

            if (trimmed.startsWith("event:")) {
                this.parseAndExtracted({
                    line: trimmed,
                    state,
                    extractor: extractor ?? [],
                    eventName: "event",
                });
            }

            if (state.hasStateByKey("extracted")) {
                const extracted = state.getStateOne("extracted") as Record<
                    string,
                    any
                >;
                const extractedLongDuration = stateLongDuration.getStateOne(
                    "extractedLongDuration",
                ) as Record<string, any>;

                stateLongDuration.setState({
                    extractedLongDuration: {
                        ...extractedLongDuration,
                        ...extracted,
                    },
                });

                try {
                    if (encodeBytes) {
                        controller.enqueue(
                            encoder.encode(JSON.stringify(extracted)),
                        );
                    } else {
                        controller.enqueue(extracted);
                    }
                } catch (e) {
                    throw new Error(`Falha no envio de dados: ${e}`);
                }

                state.clearState();
            }
        }

        return false;
    }

    private streamIA({
        body,
        encodeBytes,
        extractor,
    }: streamIaType<TData, TEvent>) {
        const bodyReader = body.getReader();
        const buffer = this.bufferControl();
        const timeOutId = this.timeOutControl();
        const state = this.stateLocal();
        const stateLongDuration = this.stateLocal();
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
                                throw new Error(
                                    `Falha ao fechar o controller: ${error}`,
                                );
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
                            stateLongDuration,
                        });
                        if (isDone) {
                            const finalData = stateLongDuration.getStateOne(
                                "extractedLongDuration",
                            ) as Record<string, unknown> | undefined;
                            this.onDone?.(finalData ?? {});
                            timeOutId.clearTime();
                            break;
                        }
                    }
                } catch (error) {
                    timeOutId.clearTime();
                    try {
                        controller.error(error);
                    } catch (error) {
                        throw new Error(
                            `Falha ao enviar error ao controller: ${error}`,
                        );
                    }
                } finally {
                    try {
                        await bodyReader.cancel();
                        bodyReader.releaseLock();
                    } catch (error) {
                        throw new Error(
                            `Falha ao cancelar ou liberar o lock do bodyReader: ${error}`,
                        );
                    }
                }
            },
            cancel() {
                timeOutId.clearTime();
                bodyReader.cancel().catch(() => {});
            },
        });
    }

    public async fetchIA({
        encodeBytes,
        signal,
        method,
        body,
        extractor,
    }: FetchOptions<TData, TEvent>) {
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
            }) as ReadableStream<Record<string, unknown> | Uint8Array>;
        } else {
            const extractors = extractor ?? this.extractor;
            let data = await fetcher.json();

            if (extractors) {
                for (const extItem of extractors) {
                    data = extItem.fn({ data });
                }
            }

            return data;
        }
    }
}
