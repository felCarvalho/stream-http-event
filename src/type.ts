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
    getState: () => Record<string, unknown>;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

export interface condicionalExtract {
    key: string;
    path: string;
    condition: string;
}

export interface extract {
    key: string;
    forExtract: string;
}

export interface ExtractorsType {
    defaultExtract: extract[];
    conditionalxtractor?: condicionalExtract[];
}

export interface dataFetchType<
    H extends Record<string, string> = Record<string, string>,
    B extends Record<string, unknown> = Record<string, unknown>,
> {
    url: string;
    headers?: H;
    timeOut?: number;
    onDone?: (finalData: Record<string, unknown>) => void;
    body?: B;
    extractors: ExtractorsType;
}

export interface serializeType {
    buffer: bufferControlType;
    state: stateLocalType;
}

export interface timeoutType {
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

export interface streamIaType {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
    prefixKeys?: boolean;
}

export interface FetchOptions {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    prefixKeys?: boolean;
}
