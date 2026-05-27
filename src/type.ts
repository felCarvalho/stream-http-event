export interface bufferControlType {
    getBuffer: () => string;
    setBuffer: (data: string) => void;
    add: (data: string) => void;
}

export interface timeOutControlType {
    getTime: () => ReturnType<typeof setTimeout> | undefined;
    setTime: ({ id }: { id: ReturnType<typeof setTimeout> }) => void;
    clearTime: () => void;
}

export interface dataFetchType {
    url: string;
    headers?: Record<string, string>;
    body?: any;
    extractor: (data: string) => any;
    timeOut?: number;
}

export interface serializeType {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor: (data: string) => any;
    encodeBytes: undefined | boolean;
}

export interface timeoutType {
    controller: ReadableStreamDefaultController<any>;
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

export interface streamIaType {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
}

export interface FetchOptions {
    signal?: AbortSignal;
    encodeBytes?: boolean;
}
