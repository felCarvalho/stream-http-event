# @felipe-lib/stream-http-event

[![npm version](https://img.shields.io/badge/npm-v1.4.6-blue)](https://www.npmjs.com/package/@felipe-lib/stream-http-event)
[![license](https://img.shields.io/badge/license-ISC-green)](./LICENSE)

**Zero dependências em runtime.** Consuma respostas HTTP em streaming de provedores de IA (OpenAI, Anthropic, Groq, DeepSeek, etc.) via o protocolo [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

Funciona em qualquer runtime com `fetch`, `ReadableStream`, `TextDecoder` e `TextEncoder` — navegadores, Node.js 18+, Deno, Bun, Cloudflare Workers.

---

# Português

## Índice

- [Início Rápido](#início-rápido)
- [Instalação](#instalação)
- [Conceitos Fundamentais](#conceitos-fundamentais)
- [Referência da API](#referência-da-api)
  - [`dataFetch()`](#datafetch)
  - [`fetchIA()`](#fetchia)
  - [`extractorType`](#extractortype)
- [Guias](#guias)
  - [Streaming Básico (OpenAI / Groq)](#streaming-básico-openai--groq)
  - [Extratores por Provedor (Anthropic)](#extratores-por-provedor-anthropic)
  - [Cancelamento](#cancelamento)
  - [Salvando a Resposta Completa](#salvando-a-resposta-completa)
  - [Fallback Não-Streaming](#fallback-não-streaming)
  - [Pipe para Arquivo](#pipe-para-arquivo)
  - [Servidor Proxy HTTP](#servidor-proxy-http)
  - [Múltiplos Provedores em Paralelo](#múltiplos-provedores-em-paralelo)
- [Tipos TypeScript](#tipos-typescript)
- [Funcionamento Interno](#funcionamento-interno)
- [Licença](#licença)

---

## Início Rápido

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

// 1. Configurar
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-seu-token" },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});

// 2. Requisitar
const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá!" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

// 3. Ler
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

---

## Instalação

```bash
npm install @felipe-lib/stream-http-event
# ou
pnpm add @felipe-lib/stream-http-event
```

---

## Conceitos Fundamentais

**Qual problema isso resolve.** Provedores de IA retornam respostas em streaming como bytes SSE brutos. Fazer o parsing disso manualmente significa lidar com bufferização, divisão de linhas, detecção de `[DONE]` e formatos de resposta específicos de cada provedor. Esta biblioteca cuida de tudo isso e te entrega um `ReadableStream` limpo.

**Padrão de dois passos.**
1. `dataFetch()` — configura a instância (URL, headers, timeout, extratores, callback `onDone`). Chame uma vez.
2. `fetchIA()` — executa a requisição. Retorna um `ReadableStream` (se a resposta for `text/event-stream`) ou um objeto JSON parseado (fallback para não-streaming).

**Extratores** são funções `({ data, event? }) => Record<string, unknown>` que mapeiam os dados para o formato desejado. No streaming, cada chunk SSE é processado. No fallback JSON (não-streaming), os extratores são aplicados sequencialmente sobre o JSON parseado (sem `event`). Sem extratores, nada é enfileirado no stream. Com extratores, cada chunk se torna o que sua função retornar.

---

## Referência da API

### `dataFetch()`

Configura a instância. Deve ser chamado antes de `fetchIA()`.

```typescript
stream.dataFetch(config: dataFetchType): void
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `url` | `string` | Sim | Endpoint do provedor de IA |
| `headers` | `Record<string, string>` | Não | Headers HTTP (Authorization, Content-Type, etc.) |
| `timeOut` | `number` | Não | Timeout de inatividade em milissegundos. Reseta a cada chunk. Sem limite de tempo total. |
| `extractor` | `extractorType[]` | Não | Extratores padrão para todas as chamadas `fetchIA()`. Podem ser sobrescritos por chamada. |
| `onDone` | `(finalData: Record<string, unknown>) => void` | Não | Callback disparado quando o stream termina. Recebe a resposta completa acumulada (merge de todos os chunks extraídos). Útil para salvar em banco de dados. |

---

### `fetchIA()`

Executa a requisição HTTP e retorna um `ReadableStream` ou um objeto JSON parseado.

```typescript
stream.fetchIA(options: FetchOptions): Promise<ReadableStream | object>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `body` | `string` | Não | Corpo da requisição (geralmente `JSON.stringify({...})`) |
| `method` | `string` | Não | Método HTTP. Padrão: `"POST"` |
| `signal` | `AbortSignal` | Não | Sinal do AbortController para cancelamento da requisição |
| `encodeBytes` | `boolean` | Não | Se `true`, enfileira `Uint8Array`. Se `false`/`undefined`, enfileira objetos planos. |
| `extractor` | `extractorType[]` | Não | Extratores por chamada. Sobrescreve os extratores definidos em `dataFetch()`. |

**Retorna:**
- `ReadableStream<Record<string, unknown> | Uint8Array>` — se `Content-Type` for `text/event-stream`
- `object` — a resposta JSON parseada para requisições não-streaming. Se houver extratores (de instância ou por chamada), eles são aplicados sequencialmente sobre o JSON.

**Erros:**
- Lança erro se `dataFetch()` não foi chamado (nenhuma URL configurada).
- Lança erro se a resposta HTTP não for OK (`!fetcher.ok`).
- Lança erro se a resposta não tiver corpo.

---

### `extractorType`

Cada função extratora recebe os campos `data` e `event` (opcional) do chunk atual.

```typescript
type extractorType<TData extends object, TEvent = unknown> = {
    fn: ({ data, event }: { data: TData; event?: TEvent }) => Record<string, unknown>;
};
```

**Comportamento:**
- `event` é **opcional** — ausente em respostas JSON não-streaming.
- Se sua função retornar `{}` (vazio), nada é enfileirado para aquele chunk.
- **Streaming:** múltiplos extratores rodam sequencialmente por linha. O resultado do **último** extrator determina o que é enfileirado. Valores se acumulam em `extractedLongDuration` via spread merge (`{ ...antigo, ...novo }`) e são entregues ao `onDone` quando o stream encerra.
- **JSON (não-streaming):** todos os extratores são aplicados em sequência, e o resultado de cada um alimenta o `data` do próximo. O resultado final é retornado diretamente (não passa por `extractedLongDuration` nem `onDone`).

---

## Guias

### Streaming Básico (OpenAI / Groq)

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-seu-token"
    },
    timeOut: 30000,
    extractor: [{
        fn: ({ data }) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explique SSE" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

O Groq segue o mesmo padrão — usa API compatível com OpenAI:

```typescript
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk-seu-token",
        "Content-Type": "application/json"
    },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});
```

---

### Extratores por Provedor (Anthropic)

O Anthropic usa um formato SSE diferente — adapte o extrator:

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "x-api-key": "sk-ant-seu-token",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    },
    timeOut: 30000,
    extractor: [{
        fn: ({ data }) => {
            if (data.type === "content_block_delta") {
                return { text: data.delta?.text };
            }
            return {};
        }
    }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Olá" }],
        stream: true
    })
}) as ReadableStream<{ text: string }>;
```

---

### Cancelamento

**Via AbortController (antes da requisição começar):**

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }),
    signal: controller.signal
});
```

**Via `reader.cancel()` (durante o stream):**

```typescript
const reader = readableStream.getReader();

setTimeout(() => reader.cancel(), 5000); // cancela após 5 segundos

while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log(value);
}
```

Quando o consumidor cancela, o `bodyReader` interno é cancelado e o timeout de inatividade é limpo automaticamente.

---

### Salvando a Resposta Completa

Use `onDone` para capturar os dados acumulados quando o stream terminar — ideal para persistir em banco de dados no backend:

```typescript
stream.dataFetch({
    url: "https://api.deepseek.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-seu-token" },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }],
    onDone: (finalData) => {
        console.log("Resposta completa:", finalData);
        // await db.messages.update({ response: finalData.content });
    }
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Explique RAG" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

O objeto `finalData` é o spread-merge de cada chunk extraído. Sem extratores, `onDone` recebe `{}`.

---

### Fallback Não-Streaming

Se a resposta não for `text/event-stream`, `fetchIA()` retorna um objeto JSON parseado. Os extratores configurados em `dataFetch()` também são aplicados — basta omitir `stream: true` no body:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.message?.content ?? ""
        })
    }]
});

const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá" }],
        stream: false
    })
});

console.log(result.content); // extraído pelo extrator
```

Sem extratores, o JSON cru da API é retornado (ex.: `result.choices[0].message.content`).

---

### Pipe para Arquivo

Defina `encodeBytes: true` para receber chunks como `Uint8Array` — útil para escrever em disco:

```typescript
import { createWriteStream } from "node:fs";

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [{ fn: ({ data }) => ({ content: data.choices?.[0]?.delta?.content }) }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }),
    encodeBytes: true
}) as ReadableStream<Uint8Array>;

const fileStream = createWriteStream("response.jsonl");
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    fileStream.write(value);
}
fileStream.end();
```

---

### Servidor Proxy HTTP

Encaminhe o stream diretamente para um cliente via Bun, Node.js ou Deno:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }
});

Bun.serve({
    port: 3000,
    async fetch(req) {
        const body = await req.json();
        const aiStream = await stream.fetchIA({
            body: JSON.stringify({ ...body, stream: true }),
            encodeBytes: true
        }) as ReadableStream<Uint8Array>;

        return new Response(aiStream, {
            headers: { "Content-Type": "text/event-stream" }
        });
    }
});
```

---

### Múltiplos Provedores em Paralelo

Cada instância é independente — execute-as concorrentemente:

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-openai-..." },
    timeOut: 30000
});

const groqStream = new StreamHttpEvent();
groqStream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: { "Authorization": "Bearer gsk-groq-..." },
    timeOut: 15000
});

const [openaiResult, groqResult] = await Promise.all([
    openaiStream.fetchIA({ body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }) }),
    groqStream.fetchIA({ body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [...], stream: true }) })
]);
```

---

## Tipos TypeScript

```typescript
// --- Tipos públicos ---

interface dataFetchType<TData extends object, TEvent = unknown> {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
    onDone?: (finalData: Record<string, unknown>) => void;
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType<TData, TEvent>[];
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({ data, event }: { data: TData; event?: TEvent }) => Record<string, unknown>;
}
```

---

## Funcionamento Interno

### Buffer

Chunks de rede podem chegar em tamanhos arbitrários, dividindo linhas SSE no meio. O buffer acumula bytes recebidos e só processa linhas completas (terminadas com `\n`). Fragmentos incompletos são mantidos até o próximo chunk chegar.

### Timeout

O timeout é **baseado em inatividade** — ele reseta a cada chunk recebido. Não há limite de duração total. Se nenhum dado chegar durante os `timeOut` milissegundos configurados, o stream é abortado via `controller.error()` e `bodyReader.cancel()`.

### Estados

Dois estados internos rastreiam dados durante o streaming:

| Estado | Escopo | Propósito |
|--------|--------|-----------|
| `state` | Uma linha SSE | Mantém `data`, `event` e `extracted` parseados para o chunk atual. Limpo após enfileirar. |
| `stateLongDuration` | Stream inteiro | Acumula `data` (mais recente) e `extractedLongDuration` (merge de todos os chunks). Entregue ao `onDone`. |

### `[DONE]`

O protocolo SSE sinaliza fim do stream com `data: [DONE]`. Quando detectado, o controller é fechado, `onDone` é chamado com `extractedLongDuration` acumulado e o loop de leitura encerra.

### Cancelamento

Quando o consumidor chama `reader.cancel()`, o callback de cancelamento do `ReadableStream` limpa o timer de inatividade e cancela o `bodyReader` interno. Nenhum recurso vaza.

---

## Licença

ISC

---

# English

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation-1)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference-1)
  - [`dataFetch()`](#datafetch-1)
  - [`fetchIA()`](#fetchia-1)
  - [`extractorType`](#extractortype-1)
- [Guides](#guides-1)
  - [Basic Streaming (OpenAI / Groq)](#basic-streaming-openai--groq)
  - [Per-Provider Extractors (Anthropic)](#per-provider-extractors-anthropic)
  - [Cancellation](#cancellation-1)
  - [Saving the Full Response](#saving-the-full-response)
  - [Non-Streaming Fallback](#non-streaming-fallback-1)
  - [Piping to File](#piping-to-file-1)
  - [HTTP Proxy Server](#http-proxy-server-1)
  - [Multiple Providers in Parallel](#multiple-providers-in-parallel-1)
- [TypeScript Types](#typescript-types-1)
- [Internals](#internals)
- [License](#license-1)

---

## Quick Start

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

// 1. Configure
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-your-token" },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});

// 2. Request
const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

// 3. Read
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

---

## Installation

```bash
npm install @felipe-lib/stream-http-event
# or
pnpm add @felipe-lib/stream-http-event
```

---

## Core Concepts

**What problem this solves.** AI providers return streaming responses as raw SSE bytes. Parsing those manually means dealing with buffering, line splitting, `[DONE]` detection, and per-provider response shapes. This library handles all of that and gives you a clean `ReadableStream`.

**Two-step pattern.**
1. `dataFetch()` — configure the instance (URL, headers, timeout, extractors, `onDone` callback). Call once.
2. `fetchIA()` — execute the request. Returns a `ReadableStream` (if the response is `text/event-stream`) or a parsed JSON object (fallback for non-streaming).

**Extractors** are functions `({ data, event? }) => Record<string, unknown>` that map data into the shape you want. In streaming mode, each SSE chunk is processed. In JSON fallback (non-streaming), extractors are applied sequentially over the parsed JSON (no `event`). Without extractors, nothing is enqueued to the stream. With extractors, each chunk becomes whatever your function returns.

---

## API Reference

### `dataFetch()`

Configures the instance. Must be called before `fetchIA()`.

```typescript
stream.dataFetch(config: dataFetchType): void
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | AI provider endpoint |
| `headers` | `Record<string, string>` | No | HTTP headers (Authorization, Content-Type, etc.) |
| `timeOut` | `number` | No | Inactivity timeout in milliseconds. Resets on each chunk. No total-time limit. |
| `extractor` | `extractorType[]` | No | Default extractors for every `fetchIA()` call. Overridable per call. |
| `onDone` | `(finalData: Record<string, unknown>) => void` | No | Callback fired when the stream ends. Receives the full accumulated response (merge of all extracted chunks). Useful for saving to a database. |

---

### `fetchIA()`

Executes the HTTP request and returns either a `ReadableStream` or a parsed JSON object.

```typescript
stream.fetchIA(options: FetchOptions): Promise<ReadableStream | object>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `body` | `string` | No | Request body (typically `JSON.stringify({...})`) |
| `method` | `string` | No | HTTP method. Default: `"POST"` |
| `signal` | `AbortSignal` | No | AbortController signal for request cancellation |
| `encodeBytes` | `boolean` | No | If `true`, enqueues `Uint8Array`. If `false`/`undefined`, enqueues plain objects. |
| `extractor` | `extractorType[]` | No | Per-call extractors. Overrides extractors set in `dataFetch()`. |

**Returns:**
- `ReadableStream<Record<string, unknown> | Uint8Array>` — if `Content-Type` is `text/event-stream`
- `object` — the parsed JSON response for non-streaming requests. If extractors are configured (instance-level or per-call), they are applied sequentially over the JSON.

**Errors:**
- Throws if `dataFetch()` was not called (no URL configured).
- Throws if the HTTP response is not OK (`!fetcher.ok`).
- Throws if the response has no body.

---

### `extractorType`

Each extractor function receives the parsed `data` and `event` (optional) from the current chunk.

```typescript
type extractorType<TData extends object, TEvent = unknown> = {
    fn: ({ data, event }: { data: TData; event?: TEvent }) => Record<string, unknown>;
};
```

**Behavior:**
- `event` is **optional** — absent in non-streaming JSON responses.
- If your function returns `{}` (empty), nothing is enqueued for that chunk.
- **Streaming:** multiple extractors run sequentially per line. The **last** extractor's result determines what gets enqueued. Values accumulate in `extractedLongDuration` via spread merge (`{ ...old, ...new }`) and are delivered to `onDone` when the stream ends.
- **JSON (non-streaming):** all extractors are applied in sequence, each result feeding the next one's `data`. The final result is returned directly (does not go through `extractedLongDuration` or `onDone`).

---

## Guides

### Basic Streaming (OpenAI / Groq)

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-your-token"
    },
    timeOut: 30000,
    extractor: [{
        fn: ({ data }) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explain SSE" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

Groq follows the same pattern — it uses an OpenAI-compatible API:

```typescript
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk-your-token",
        "Content-Type": "application/json"
    },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});
```

---

### Per-Provider Extractors (Anthropic)

Anthropic uses a different SSE shape — adapt the extractor:

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "x-api-key": "sk-ant-your-token",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    },
    timeOut: 30000,
    extractor: [{
        fn: ({ data }) => {
            if (data.type === "content_block_delta") {
                return { text: data.delta?.text };
            }
            return {};
        }
    }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
        stream: true
    })
}) as ReadableStream<{ text: string }>;
```

---

### Cancellation

**Via AbortController (before the request starts):**

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }),
    signal: controller.signal
});
```

**Via `reader.cancel()` (mid-stream):**

```typescript
const reader = readableStream.getReader();

setTimeout(() => reader.cancel(), 5000); // cancels after 5 seconds

while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log(value);
}
```

When the consumer cancels, the internal `bodyReader` is cancelled and the inactivity timeout is cleared automatically.

---

### Saving the Full Response

Use `onDone` to capture the accumulated data when the stream finishes — ideal for persisting to a database on the backend:

```typescript
stream.dataFetch({
    url: "https://api.deepseek.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-your-token" },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }],
    onDone: (finalData) => {
        console.log("Full response:", finalData);
        // await db.messages.update({ response: finalData.content });
    }
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Explain RAG" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process.stdout.write(value.content);
}
```

The `finalData` object is the spread-merge of every extracted chunk. Without extractors, `onDone` receives `{}`.

---

### Non-Streaming Fallback

If the response is not `text/event-stream`, `fetchIA()` returns a parsed JSON object. Extractors configured in `dataFetch()` are also applied — simply omit `stream: true` from the body:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.message?.content ?? ""
        })
    }]
});

const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
    })
});

console.log(result.content); // extracted by the extractor
```

Without extractors, the raw API JSON is returned (e.g. `result.choices[0].message.content`).

---

### Piping to File

Set `encodeBytes: true` to receive `Uint8Array` chunks — useful for writing to disk:

```typescript
import { createWriteStream } from "node:fs";

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [{ fn: ({ data }) => ({ content: data.choices?.[0]?.delta?.content }) }]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }),
    encodeBytes: true
}) as ReadableStream<Uint8Array>;

const fileStream = createWriteStream("response.jsonl");
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    fileStream.write(value);
}
fileStream.end();
```

---

### HTTP Proxy Server

Forward the stream directly to a client via Bun, Node.js, or Deno:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }
});

Bun.serve({
    port: 3000,
    async fetch(req) {
        const body = await req.json();
        const aiStream = await stream.fetchIA({
            body: JSON.stringify({ ...body, stream: true }),
            encodeBytes: true
        }) as ReadableStream<Uint8Array>;

        return new Response(aiStream, {
            headers: { "Content-Type": "text/event-stream" }
        });
    }
});
```

---

### Multiple Providers in Parallel

Each instance is independent — run them concurrently:

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-openai-..." },
    timeOut: 30000
});

const groqStream = new StreamHttpEvent();
groqStream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: { "Authorization": "Bearer gsk-groq-..." },
    timeOut: 15000
});

const [openaiResult, groqResult] = await Promise.all([
    openaiStream.fetchIA({ body: JSON.stringify({ model: "gpt-4o", messages: [...], stream: true }) }),
    groqStream.fetchIA({ body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [...], stream: true }) })
]);
```

---

## TypeScript Types

```typescript
// --- Public types ---

interface dataFetchType<TData extends object, TEvent = unknown> {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
    onDone?: (finalData: Record<string, unknown>) => void;
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType<TData, TEvent>[];
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({ data, event }: { data: TData; event?: TEvent }) => Record<string, unknown>;
}
```

---

## Internals

### Buffer

Network chunks may arrive in arbitrary sizes, splitting SSE lines mid-way. The buffer accumulates incoming bytes and only processes full lines (ending with `\n`). Incomplete fragments are held until the next chunk arrives.

### Timeout

Timeout is **inactivity-based** — it resets on every received chunk. There is no total-duration limit. If no data arrives for the configured `timeOut` milliseconds, the stream is aborted via `controller.error()` and `bodyReader.cancel()`.

### States

Two internal states track data during streaming:

| State | Scope | Purpose |
|-------|-------|---------|
| `state` | One SSE line | Holds the parsed `data`, `event`, and `extracted` for the current chunk. Cleared after enqueue. |
| `stateLongDuration` | Entire stream | Accumulates `data` (latest) and `extractedLongDuration` (merged across all chunks). Delivered to `onDone`. |

### `[DONE]`

The SSE protocol signals end-of-stream with `data: [DONE]`. When detected, the controller is closed, `onDone` is called with the accumulated `extractedLongDuration`, and the read loop exits.

### Cancellation

When the consumer calls `reader.cancel()`, the `ReadableStream` cancel callback cleans up the inactivity timer and cancels the internal `bodyReader`. No resources leak.

---

## License

ISC
