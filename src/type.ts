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

export interface extractorType {
    <T>(data: string): T;
}

export interface dataFetchType {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
}

export interface serializeType {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor?: extractorType;
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
    extractor?: extractorType;
}

export interface FetchOptions {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: any;
    extractor?: extractorType;
}
