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

export interface stateLocalType {
    getState: () => unknown | undefined;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

export interface extractorType {
    key: string;
    fn: (data: Record<string, any>) => Record<string, any>;
}

export interface dataFetchType {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType[];
}

export interface serializeType {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor?: extractorType[];
    encodeBytes: undefined | boolean;
    state: stateLocalType;
}

export interface timeoutType {
    controller: ReadableStreamDefaultController<any>;
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

export interface streamIaType {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
    extractor?: extractorType[];
}

export interface FetchOptions<O extends object = object> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType[];
}
