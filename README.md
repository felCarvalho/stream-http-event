# @felipe-lib/stream-http-event

*[English](#english) | [Português](#português)*

---

## English

A lightweight TypeScript library for consuming **Server-Sent Events (SSE)** over HTTP — built specifically for streaming responses from AI/LLM APIs.

### Features

- Sends HTTP POST requests with custom headers and body
- Parses `text/event-stream` (SSE) responses in real-time via `ReadableStream`
- Handles partial/incomplete chunks across network boundaries with an internal buffer
- User-defined **extractor** to transform raw `data:` lines into structured objects
- Detects `[DONE]` as the stream termination signal
- Optionally encodes output as `Uint8Array` bytes (ideal for piping into further streams)
- Falls back to `response.json()` for non-streaming responses

### Installation

```bash
npm install @felipe-lib/stream-http-event
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
        const parsed = JSON.parse(rawData);
        return parsed.choices?.[0]?.delta?.content ?? "";
    },
});

// 2. Execute and consume the stream
// With encodeBytes: true — each chunk is encoded as Uint8Array
const stream = await streamer.fetchIA({ encodeBytes: true });

// 3. Read from the stream
const reader = stream.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(new TextDecoder().decode(value));
}

// --- Or with encodeBytes: false — values are enqueued as plain strings ---

const plainStream = await streamer.fetchIA({ encodeBytes: false });
const plainReader = plainStream.getReader();
while (true) {
    const { done, value } = await plainReader.read();
    if (done) break;
    console.log(value); // value is already a string, no TextDecoder needed
}
```

### API Reference

#### `StreamHttpEvent`

Main class for streaming HTTP event handling.

---

##### `dataFetch(options)`

Configures the fetch request and the extraction logic. **Must be called before `fetchIA()`.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The endpoint URL |
| `headers` | `Record<string, string>` | No | HTTP headers (e.g., `Authorization`, `Content-Type`) |
| `body` | `any` | No | Request body — typically `JSON.stringify(...)` |
| `extractor` | `(data: string) => any` | Yes | Transforms each parsed `data:` line into the desired output format |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | null | Body>`

Executes the HTTP request. If the response `Content-Type` is `text/event-stream`, returns a `ReadableStream` with parsed events. Otherwise, falls back to `response.json()`.

Throws an error if `dataFetch()` was not called beforehand.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `encodeBytes` | `boolean` | Yes | If `true`, each extracted chunk is `JSON.stringify()`-ed, suffixed with `\n`, and encoded as `Uint8Array`. If `false`, raw extracted values are enqueued as-is. |

---

### How SSE Parsing Works

1. `fetchIA()` makes a `POST` request to the configured URL.
2. If the response is `text/event-stream`, `streamIA()` creates a `ReadableStream` from the response body.
3. An internal buffer accumulates partial chunks (network packets may split a `data:` line mid-stream).
4. `serialize()` splits the buffer by `\n`, processes complete lines, and keeps the last (possibly incomplete) line for the next iteration.
5. Lines starting with `data:` are stripped of the prefix and passed to the user's `extractor`.
6. `[DONE]` closes the stream.
7. Empty lines and non-`data:` lines are skipped.

### Build

```bash
pnpm build
```

Uses TypeScript (`ES2020` / `ESM` output) targeting `DOM` + `ES2020` types.

---

## Português

Uma biblioteca TypeScript leve para consumir **Server-Sent Events (SSE)** sobre HTTP — criada para respostas em streaming de APIs de IA/LLM.

### Funcionalidades

- Envia requisições HTTP POST com headers e body customizados
- Faz parse de respostas `text/event-stream` (SSE) em tempo real via `ReadableStream`
- Lida com chunks parciais/incompletos com um buffer interno
- **Extractor** definido pelo usuário para transformar linhas `data:` em objetos estruturados
- Detecta `[DONE]` como sinal de término do stream
- Opcionalmente codifica a saída em `Uint8Array`
- Fallback para `response.json()` em respostas não-streaming

### Instalação

```bash
npm install @felipe-lib/stream-http-event
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
        const parsed = JSON.parse(rawData);
        return parsed.choices?.[0]?.delta?.content ?? "";
    },
});

// 2. Executar e consumir o stream
// Com encodeBytes: true — cada chunk é codificado como Uint8Array
const stream = await streamer.fetchIA({ encodeBytes: true });

// 3. Ler do stream
const reader = stream.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(new TextDecoder().decode(value));
}

// --- Ou com encodeBytes: false — valores são enfileirados como strings ---

const plainStream = await streamer.fetchIA({ encodeBytes: false });
const plainReader = plainStream.getReader();
while (true) {
    const { done, value } = await plainReader.read();
    if (done) break;
    console.log(value); // value já é string, não precisa de TextDecoder
}
```

### Referência da API

#### `StreamHttpEvent`

Classe principal para manipulação de streaming de eventos HTTP.

---

##### `dataFetch(options)`

Configura a requisição fetch e a lógica de extração. **Deve ser chamado antes de `fetchIA()`.**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `url` | `string` | Sim | A URL do endpoint |
| `headers` | `Record<string, string>` | Não | Cabeçalhos HTTP (ex.: `Authorization`, `Content-Type`) |
| `body` | `any` | Não | Corpo da requisição — normalmente `JSON.stringify(...)` |
| `extractor` | `(data: string) => any` | Sim | Transforma cada linha `data:` no formato de saída desejado |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | null | Body>`

Executa a requisição HTTP. Se o `Content-Type` for `text/event-stream`, retorna uma `ReadableStream` com os eventos processados. Caso contrário, faz fallback para `response.json()`.

Lança erro se `dataFetch()` não tiver sido chamado antes.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `encodeBytes` | `boolean` | Sim | Se `true`, cada chunk é serializado com `JSON.stringify()`, sufixado com `\n` e codificado como `Uint8Array`. Se `false`, os valores são enfileirados como estão. |

---

### Como o Parse do SSE Funciona

1. `fetchIA()` faz uma requisição `POST` para a URL configurada.
2. Se a resposta for `text/event-stream`, `streamIA()` cria uma `ReadableStream` do corpo da resposta.
3. Um buffer interno acumula chunks parciais (pacotes de rede podem dividir uma linha `data:` no meio).
4. `serialize()` divide o buffer por `\n`, processa linhas completas e mantém a última linha (possivelmente incompleta) para a próxima iteração.
5. Linhas iniciadas por `data:` têm o prefixo removido e são passadas ao `extractor`.
6. `[DONE]` fecha o stream.
7. Linhas vazias e sem `data:` são ignoradas.

### Build

```bash
pnpm build
```

Usa TypeScript (`ES2020` / `ESM`), com target `DOM` + `ES2020`.

---

## License

ISC
