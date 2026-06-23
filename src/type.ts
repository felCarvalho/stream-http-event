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

export interface BeforeRequestConfig {
    url: string;
    headers: Record<string, string>;
    body?: Record<string, unknown>;
}

export type BeforeRequestFn = (
    config: BeforeRequestConfig,
) => Promise<BeforeRequestConfig | void>;

export interface RetryType {
    max: number;
    statusCode: number[];
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
    beforeRequest?: BeforeRequestFn;
    retry?: RetryType;
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

export enum SystemError {
    EACCES = "EACCES",
    EADDRINUSE = "EADDRINUSE",
    ECONNREFUSED = "ECONNREFUSED",
    ECONNRESET = "ECONNRESET",
    EEXIST = "EEXIST",
    EISDIR = "EISDIR",
    EMFILE = "EMFILE",
    ENOENT = "ENOENT",
    ENOTDIR = "ENOTDIR",
    ENOTEMPTY = "ENOTEMPTY",
    ENOTFOUND = "ENOTFOUND",
    EPERM = "EPERM",
    EPIPE = "EPIPE",
    ETIMEDOUT = "ETIMEDOUT",
}

export const systemErrorDescription: Record<SystemError, string> = {
    [SystemError.EACCES]:
        "Tentativa de acessar um arquivo de forma proibida pelas permissões de acesso.",
    [SystemError.EADDRINUSE]:
        "Tentativa de vincular um servidor a um endereço local já ocupado por outro servidor no sistema.",
    [SystemError.ECONNREFUSED]:
        "Conexão recusada porque a máquina de destino recusou ativamente. Geralmente ocorre ao conectar a um serviço inativo no host remoto.",
    [SystemError.ECONNRESET]:
        "Conexão foi forçada a ser encerrada pelo peer. Normalmente resulta de perda de conexão no socket remoto devido a timeout ou reinicialização.",
    [SystemError.EEXIST]:
        "Um arquivo existente foi alvo de uma operação que exigia que o alvo não existisse.",
    [SystemError.EISDIR]:
        "Uma operação esperava um arquivo, mas o caminho fornecido era um diretório.",
    [SystemError.EMFILE]:
        "Número máximo de descritores de arquivo permitidos no sistema foi atingido. Para resolver, execute 'ulimit -n 2048' no shell que executará o Node.js.",
    [SystemError.ENOENT]:
        "Um componente do caminho especificado não existe. Nenhuma entidade (arquivo ou diretório) foi encontrada no caminho informado.",
    [SystemError.ENOTDIR]:
        "Um componente do caminho existe, mas não é um diretório como esperado.",
    [SystemError.ENOTEMPTY]:
        "Um diretório com entradas foi alvo de uma operação que requer um diretório vazio.",
    [SystemError.ENOTFOUND]:
        "Indica uma falha de DNS (EAI_NODATA ou EAI_NONAME).",
    [SystemError.EPERM]:
        "Tentativa de realizar uma operação que requer privilégios elevados.",
    [SystemError.EPIPE]:
        "Escrita em um pipe, socket ou FIFO sem processo para ler os dados.",
    [SystemError.ETIMEDOUT]:
        "Uma conexão ou envio falhou porque a parte conectada não respondeu dentro do período de tempo esperado.",
};
