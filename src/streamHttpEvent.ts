import type {
    dataFetchType,
    serializeType,
    timeoutType,
    streamIaType,
    FetchOptions,
} from "./type.js";

export class StreamHttpEvent {
    private url?: string;
    private headers?: Record<string, string> = {};
    private timeOut?: number;

    public dataFetch({ url, headers, timeOut }: dataFetchType) {
        this.url = url;
        this.headers = headers ?? {};
        this.timeOut = timeOut;
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

        if (this.timeOut) {
            timeOutId.setTime({
                id: setTimeout(() => {
                    controller.error(
                        new Error(
                            `Ops, Sua provedor de IA demorou mais de ${this.timeOut}ms`,
                        ),
                    );
                    bodyReader.cancel();
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
    }: serializeType) {
        const lines = buffer.getBuffer().split("\n");
        buffer.setBuffer(lines.pop() ?? "");

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine) continue;

            if (line.includes("[DONE]")) {
                controller.close();
                return true;
            }

            if (trimmedLine.startsWith("data:")) {
                const cleanData = trimmedLine.replace("data:", "").trim();

                try {
                    if (cleanData) {
                        const extracted = extractor
                            ? extractor(cleanData)
                            : cleanData;

                        if (encodeBytes) {
                            controller.enqueue(
                                encoder.encode(
                                    JSON.stringify(extracted) + "\n",
                                ),
                            );
                        } else {
                            controller.enqueue(JSON.stringify(extracted));
                        }
                    }
                } catch (error) {
                    console.error("Error extracting data:", error);
                }
            }
        }

        return false;
    }

    private async streamIA({ body, encodeBytes, extractor }: streamIaType) {
        if (!body) return null;
        const bodyReader = body.getReader();
        const buffer = this.bufferControl();
        const timeOutId = this.timeOutControl();
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
                            controller.close();
                            break;
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
                            extractor: extractor,
                            encodeBytes,
                        });
                        if (isDone) {
                            timeOutId.clearTime();
                            break;
                        }
                    }
                } catch (error) {
                    timeOutId.clearTime();
                    controller.error(error);
                } finally {
                    bodyReader.releaseLock();
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
            body: body ?? "{}",
            signal: signal,
        });

        if (!fetcher.ok) {
            throw new Error(fetcher.statusText);
        }

        if (!fetcher.body) {
            throw new Error("Ops, nenhuma corpo de resposta na sua requisição");
        }

        const contentType = fetcher.headers.get("content-type") ?? "";

        if (contentType?.includes("text/event-stream")) {
            return this.streamIA({
                body: fetcher.body,
                encodeBytes,
                extractor,
            });
        } else {
            return fetcher.json() as Promise<Body>;
        }
    }
}
