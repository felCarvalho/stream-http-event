import type { getBufferType } from "./type";

export class StreamHttpEvent {
    private url?: string;
    private headers?: Record<string, string> = {};
    private body?: any;
    private extractor?: (data: string) => any;

    public dataFetch({
        url,
        headers,
        body,
        extractor,
    }: {
        url: string;
        headers?: Record<string, string>;
        body?: any;
        extractor: (data: string) => any;
    }) {
        this.url = url;
        this.headers = headers ?? {};
        this.body = body;
        this.extractor = extractor;
    }

    private getBuffer() {
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

    private serialize({
        buffer,
        controller,
        encoder,
        extractor,
        encodeBytes,
    }: {
        buffer: getBufferType;
        controller: ReadableStreamDefaultController<any>;
        encoder: TextEncoder;
        extractor: (data: string) => any;
        encodeBytes: boolean;
    }) {
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
                        const extracted = extractor(cleanData);

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

    private streamIA({
        body,
        encodeBytes,
    }: {
        body: ReadableStream<Uint8Array>;
        encodeBytes: boolean;
    }) {
        if (!body) return null;
        const bodyReader = body.getReader();
        const buffer = this.getBuffer();
        const decoder: TextDecoder = new TextDecoder();
        const encoder: TextEncoder = new TextEncoder();

        return new ReadableStream({
            start: async (controller) => {
                try {
                    while (true) {
                        const { value, done } = await bodyReader.read();

                        if (done) {
                            controller.close();
                            break;
                        }

                        buffer.add(
                            decoder.decode(value, {
                                stream: true,
                            }),
                        );

                        const isDone = this.serialize({
                            buffer,
                            controller,
                            encoder,
                            extractor:
                                this.extractor ?? ((data: string) => data),
                            encodeBytes,
                        });
                        if (isDone) {
                            break;
                        }
                    }
                } catch (error) {
                    controller.error(error);
                } finally {
                    bodyReader.releaseLock();
                }
            },
        });
    }

    public async fetchIA({ encodeBytes }: { encodeBytes: boolean }) {
        if (!this.url) {
            throw new Error("dataFetch() must be called before fetchIA()");
        }

        const fetcher = await fetch(this.url, {
            method: "POST",
            headers: this.headers,
            body: this.body,
        });

        if (!fetcher.ok) {
            throw new Error(fetcher.statusText);
        }

        if (!fetcher.body) {
            throw new Error("No body");
        }

        const contentType = fetcher.headers.get("content-type") ?? "";

        if (contentType?.includes("text/event-stream")) {
            return this.streamIA({ body: fetcher.body, encodeBytes });
        } else {
            return fetcher.json() as Promise<Body>;
        }
    }
}
