# @felipe-lib/stream-http-event

*[English](#english) | [Português](#português)*

---

## English

A lightweight TypeScript library for consuming **Server-Sent Events (SSE)** over HTTP — built specifically for streaming responses from AI/LLM APIs like OpenAI, Anthropic, and similar services.

### Features

- Sends HTTP POST requests with custom headers and body
- Parses `text/event-stream` (SSE) responses in real-time via `ReadableStream`
- Handles partial/incomplete chunks across network boundaries with an internal buffer
- Applies a user-defined **extractor** to transform raw `data:` lines into structured objects
- Detects `[DONE]` as the stream termination signal
- Optionally encodes output as `Uint8Array` bytes (ideal for piping into further streams)
- Falls back to `response.json()` for non-streaming responses

### Installation

```bash
npm install @felipe-lib/stream-http-event
```

or

```bash
pnpm add @felipe-lib/stream-http-event
```

### Quick Start

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const streamer = new StreamHttpEvent();

// 1. Configure the request and extractor
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true,
    }),
    extractor: (rawData: string) => {
        // Parse the SSE data line — OpenAI format example:
        // {"choices":[{"delta":{"content":"Hello"}}]}
        const parsed = JSON.parse(rawData);
        return parsed.choices?.[0]?.delta?.content ?? "";
    },
});

// 2. Execute and consume the stream
const stream = await streamer.fetchIA({ encodeBytes: true });

// 3. Read from the stream
const reader = stream.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(value); // Uint8Array → decode to string if needed
}
```

### API Reference

#### `StreamHttpEvent`

Main class for streaming HTTP event handling.

---

##### `dataFetch(options)`

Configures the fetch request and the extraction logic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The endpoint URL |
| `headers` | `Record<string, string>` | No | HTTP headers (e.g., `Authorization`, `Content-Type`) |
| `body` | `any` | No | Request body — typically `JSON.stringify(...)` |
| `extractor` | `(data: string) => any` | Yes | Transforms each parsed `data:` line into the desired output format |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | Body>`

Executes the HTTP request. If the response `Content-Type` is `text/event-stream`, it returns a `ReadableStream<Uint8Array>` with parsed events. Otherwise, it falls back to `response.json()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `encodeBytes` | `boolean` | Yes | If `true`, each extracted chunk is `JSON.stringify()`-ed, suffixed with `\n`, and encoded as `Uint8Array`. If `false`, raw extracted values are enqueued as-is. |

---

### How SSE Parsing Works

1. `fetchIA()` makes a `POST` request to the configured URL.
2. If the response is `text/event-stream`, `streamIA()` creates a `ReadableStream` that pipes the response body through a `TextDecoder`.
3. The internal `getBuffer()` accumulates partial chunks — since network packets may split a `data:` line in the middle.
4. `serialize()` splits the buffer by `\n`, processes complete lines, and keeps the last (possibly incomplete) line in the buffer for the next iteration.
5. Lines starting with `data:` have the prefix stripped and are passed to the user's `extractor`.
6. If a line contains `[DONE]`, the stream is closed.
7. Empty lines and non-`data:` lines are skipped.

### Types

```typescript
export interface getBufferType {
    getBuffer: () => string;
    setBuffer: (data: string) => void;
    add: (data: string) => void;
}
```

---

## Português

Uma biblioteca TypeScript leve para consumir **Server-Sent Events (SSE)** sobre HTTP — criada especificamente para respostas em streaming de APIs de IA/LLM como OpenAI, Anthropic e serviços similares.

### Funcionalidades

- Envia requisições HTTP POST com headers e body customizados
- Faz parse de respostas `text/event-stream` (SSE) em tempo real via `ReadableStream`
- Lida com chunks parciais/incompletos entre pacotes de rede com um buffer interno
- Aplica um **extractor** definido pelo usuário para transformar linhas `data:` brutas em objetos estruturados
- Detecta `[DONE]` como sinal de término do stream
- Opcionalmente codifica a saída em bytes `Uint8Array` (ideal para encadear em outros streams)
- Fallback para `response.json()` em respostas que não são streaming

### Instalação

```bash
npm install @felipe-lib/stream-http-event
```

ou

```bash
pnpm add @felipe-lib/stream-http-event
```

### Guia Rápido

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const streamer = new StreamHttpEvent();

// 1. Configurar a requisição e o extrator
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Olá!" }],
        stream: true,
    }),
    extractor: (rawData: string) => {
        // Parse da linha data: — exemplo do formato OpenAI:
        // {"choices":[{"delta":{"content":"Olá"}}]}
        const parsed = JSON.parse(rawData);
        return parsed.choices?.[0]?.delta?.content ?? "";
    },
});

// 2. Executar e consumir o stream
const stream = await streamer.fetchIA({ encodeBytes: true });

// 3. Ler do stream
const reader = stream.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(value); // Uint8Array → decode para string se necessário
}
```

### Referência da API

#### `StreamHttpEvent`

Classe principal para manipulação de streaming de eventos HTTP.

---

##### `dataFetch(options)`

Configura a requisição fetch e a lógica de extração.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `url` | `string` | Sim | A URL do endpoint |
| `headers` | `Record<string, string>` | Não | Cabeçalhos HTTP (ex.: `Authorization`, `Content-Type`) |
| `body` | `any` | Não | Corpo da requisição — normalmente `JSON.stringify(...)` |
| `extractor` | `(data: string) => any` | Sim | Transforma cada linha `data:` processada no formato de saída desejado |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | Body>`

Executa a requisição HTTP. Se o `Content-Type` da resposta for `text/event-stream`, retorna uma `ReadableStream<Uint8Array>` com os eventos processados. Caso contrário, faz fallback para `response.json()`.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `encodeBytes` | `boolean` | Sim | Se `true`, cada chunk extraído é serializado com `JSON.stringify()`, sufixado com `\n` e codificado como `Uint8Array`. Se `false`, os valores extraídos são enfileirados como estão. |

---

### Como o Parse do SSE Funciona

1. `fetchIA()` faz uma requisição `POST` para a URL configurada.
2. Se a resposta for `text/event-stream`, `streamIA()` cria uma `ReadableStream` que encadeia o corpo da resposta através de um `TextDecoder`.
3. O `getBuffer()` interno acumula chunks parciais — pois pacotes de rede podem dividir uma linha `data:` no meio.
4. `serialize()` divide o buffer por `\n`, processa linhas completas e mantém a última linha (possivelmente incompleta) no buffer para a próxima iteração.
5. Linhas que começam com `data:` têm o prefixo removido e são passadas para o `extractor` do usuário.
6. Se uma linha contiver `[DONE]`, o stream é fechado.
7. Linhas vazias e linhas que não começam com `data:` são ignoradas.

### Tipos

```typescript
export interface getBufferType {
    getBuffer: () => string;
    setBuffer: (data: string) => void;
    add: (data: string) => void;
}
```

---

## License

ISC
