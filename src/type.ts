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
    getState: () => unknown | Record<string, unknown>;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

export interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event: TEvent;
    }) => Record<string, unknown>;
}

export interface dataFetchType<TData extends object, TEvent = unknown> {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
}

export interface serializeType<TData extends object, TEvent = unknown> {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor?: extractorType<TData, TEvent>[];
    encodeBytes: boolean | undefined;
    state: stateLocalType;
    stateLongDuration: stateLocalType;
}

export interface timeoutType {
    controller: ReadableStreamDefaultController<any>;
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

export interface streamIaType<TData extends object, TEvent = unknown> {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
    extractor?: extractorType<TData, TEvent>[];
}

export interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType<TData, TEvent>[];
}
