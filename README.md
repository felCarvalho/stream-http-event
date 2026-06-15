# @felipe-lib/stream-http-event

[![npm version](https://img.shields.io/badge/npm-v1.4.6-blue)](https://www.npmjs.com/package/@felipe-lib/stream-http-event)
[![license](https://img.shields.io/badge/license-ISC-green)](./LICENSE)

**Zero dependências em runtime.** Consuma respostas HTTP em streaming de provedores de IA (OpenAI, Anthropic, Groq, DeepSeek, etc.) via o protocolo [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

Funciona em qualquer runtime com `fetch`, `AsyncGenerator`, `TextDecoder` e `TextEncoder` — navegadores, Node.js 18+, Deno, Bun, Cloudflare Workers.

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
- [Builders por Provedor (DeepSeek)](#builders-por-provedor-deepseek)
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
    headers: { Authorization: "Bearer sk-seu-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá!" }],
        stream: true,
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
});

// 2. Requisitar
const generator = await stream.fetchIA();

// 3. Ler
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

**Com builder tipado (DeepSeek):**

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-seu-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Olá!").build()])
        .stream(true)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
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

**Qual problema isso resolve.** Provedores de IA retornam respostas em streaming como bytes SSE brutos. Fazer o parsing disso manualmente significa lidar com bufferização, divisão de linhas, detecção de `[DONE]` e formatos de resposta específicos de cada provedor. Esta biblioteca cuida de tudo isso e te entrega um `AsyncGenerator` limpo.

**Padrão de dois passos.**

1. `dataFetch()` — configura a instância (URL, headers, body, timeout, extratores, callback `onDone`). Chame uma vez.
2. `fetchIA()` — executa a requisição. Retorna um `AsyncGenerator` (se a resposta for `text/event-stream`) ou um objeto JSON parseado (fallback para não-streaming).

**Extratores** são funções `({ data, event? }) => Record<string, unknown>` que mapeiam os dados para o formato desejado. No streaming, cada chunk SSE é processado. No fallback JSON (não-streaming), os extratores são aplicados sequencialmente sobre o JSON parseado (sem `event`). Sem extratores, nada é enviado ao generator. Com extratores, cada chunk se torna o que sua função retornar.

---

## Referência da API

### `dataFetch()`

Configura a instância. Deve ser chamado antes de `fetchIA()`.

```typescript
stream.dataFetch(config: dataFetchType): void
```

| Parâmetro   | Tipo                                                      | Obrigatório | Descrição                                                                                                                                                  |
| ----------- | --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`       | `string`                                                  | Sim         | Endpoint do provedor de IA                                                                                                                                 |
| `headers`   | `Record<string, string>` ou tipo customizado via Builder  | Não         | Headers HTTP (Authorization, Content-Type, etc.). Pode ser tipado automaticamente ao usar um builder de provedor.                                          |
| `body`      | `Record<string, unknown>` ou tipo customizado via Builder | Não         | Corpo da requisição (serializado como JSON). Configure aqui ou use um builder de provedor para autocompletar todos os campos.                              |
| `timeOut`   | `number`                                                  | Não         | Timeout de inatividade em milissegundos. Reseta a cada chunk. Sem limite de tempo total.                                                                   |
| `extractor` | `extractorType[]`                                         | Não         | Extratores padrão para todas as chamadas `fetchIA()`.                                                                                                      |
| `onDone`    | `(finalData: Record<string, unknown>) => void`            | Não         | Callback disparado quando o stream termina. Recebe a resposta completa acumulada (merge de todos os chunks extraídos). Útil para salvar em banco de dados. |

---

### `fetchIA()`

Executa a requisição HTTP e retorna um `AsyncGenerator` ou um objeto JSON parseado.

```typescript
stream.fetchIA(options: FetchOptions): Promise<AsyncGenerator | object>
```

| Parâmetro     | Tipo          | Obrigatório | Descrição                                                                                              |
| ------------- | ------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `method`      | `string`      | Não         | Método HTTP. Padrão: `"POST"`                                                                          |
| `signal`      | `AbortSignal` | Não         | Sinal do AbortController para cancelamento da requisição                                               |
| `encodeBytes` | `boolean`     | Não         | Se `true`, os chunks yieldados são `Uint8Array`. Se `false`/`undefined`, os chunks são objetos planos. |

**Retorna:**

- `AsyncGenerator<Record<string, unknown> | Uint8Array, void, unknown>` — se `Content-Type` for `text/event-stream`. Consuma com `for await (const chunk of generator)`.
- `object` — a resposta JSON parseada para requisições não-streaming. Se houver extratores configurados em `dataFetch()`, eles são aplicados sequencialmente sobre o JSON.

**Erros:**

- Lança erro se `dataFetch()` não foi chamado (nenhuma URL configurada).
- Lança erro se a resposta HTTP não for OK (`!fetcher.ok`).
- Lança erro se a resposta não tiver corpo.

---

### `extractorType`

Cada função extratora recebe os campos `data` e `event` (opcional) do chunk atual.

```typescript
type extractorType<TData extends object, TEvent = unknown> = {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event?: TEvent;
    }) => Record<string, unknown>;
};
```

**Comportamento:**

- `event` é **opcional** — ausente em respostas JSON não-streaming.
- Se sua função retornar `{}` (vazio), nada é enviado para aquele chunk.
- **Streaming:** múltiplos extratores rodam sequencialmente por linha. O resultado do **último** extrator determina o que é yieldado. Valores se acumulam em `extractedLongDuration` via spread merge (`{ ...antigo, ...novo }`) e são entregues ao `onDone` quando o stream encerra.
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
        Authorization: "Bearer sk-seu-token",
    },
    timeOut: 30000,
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explique SSE" }],
        stream: true,
    },
    extractor: [
        {
            fn: ({ data }) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            },
        },
    ],
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

O Groq segue o mesmo padrão — usa API compatível com OpenAI:

````typescript
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk-seu-token",
        "Content-Type": "application/json"
    },
    body: {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Olá" }],
        stream: true
    },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

> **Dica:** O Groq também pode usar os [builders do DeepSeek](#builders-por-provedor-deepseek) — o formato do body é o mesmo (OpenAI-compatível). Só troque a URL.

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
    body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Olá" }],
        stream: true
    },
    extractor: [{
        fn: ({ data }) => {
            if (data.type === "content_block_delta") {
                return { text: data.delta?.text };
            }
            return {};
        }
    }]
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.text);
}

---

### Builders por Provedor (DeepSeek / OpenAI-compatível)

Use builders para montar headers e body com tipos exatos e autocompletar — sem decorar chaves nem digitar manualmente. **Funciona com qualquer provedor que siga o padrão OpenAI** (Groq, Together AI, Fireworks, etc.), bastando trocar a URL:

> **Compatível com:** Groq, Together AI, Fireworks, Perplexity, xAI, e qualquer API que use o formato `{ messages, model, stream, temperature, ... }`. Apenas ajuste a URL no `dataFetch()`.

```typescript
import {
    DeepSeekHeadersBuilder, DeepSeekBodyBuilder, DeepSeekMessageBuilder,
    DeepSeekThinkingBuilder, DeepSeekToolBuilder, DeepSeekToolParametersBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-seu-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([
            new DeepSeekMessageBuilder().role("system").content("Você é um assistente").build(),
            new DeepSeekMessageBuilder().role("user").content("Qual o clima?").build(),
        ])
        .thinking(
            new DeepSeekThinkingBuilder().type("enabled").reasoningEffort("high").build()
        )
        .tools([
            new DeepSeekToolBuilder()
                .name("getWeather")
                .description("Busca clima da cidade")
                .parameters(
                    new DeepSeekToolParametersBuilder()
                        .property("city", { type: "string", description: "Nome da cidade" })
                        .required("city")
                        .build()
                )
                .build(),
        ])
        .temperature(0.7)
        .stream(true)
        .build(),
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }],
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
````

Cada builder segue a interface correspondente. Se a interface mudar, o builder acompanha automaticamente. O `.build()` retorna o objeto tipado exato para `dataFetch()`.

---

### Cancelamento

**Via AbortController (antes da requisição começar):**

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const generator = await stream.fetchIA({
    signal: controller.signal,
});

for await (const chunk of generator) {
    console.log(chunk);
}
```

**Via `break` no `for await` (durante o stream):**

```typescript
const generator = await stream.fetchIA();

let count = 0;
for await (const chunk of generator) {
    console.log(chunk);
    count++;
    if (count >= 10) break; // cancela após 10 chunks
}
```

Quando o consumidor cancela via `break` ou `AbortSignal`, o `bodyReader` interno é cancelado e o timeout de inatividade é limpo automaticamente via bloco `finally`.

---

### Salvando a Resposta Completa

Use `onDone` para capturar os dados acumulados quando o stream terminar — ideal para persistir em banco de dados no backend:

```typescript
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-seu-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([
            new DeepSeekMessageBuilder()
                .role("user")
                .content("Explique RAG")
                .build(),
        ])
        .stream(true)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
    onDone: (finalData) => {
        console.log("Resposta completa:", finalData);
        // await db.messages.update({ response: finalData.content });
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

O objeto `finalData` é o spread-merge de cada chunk extraído. Sem extratores, `onDone` recebe `{}`.

---

### Fallback Não-Streaming

Se a resposta não for `text/event-stream`, `fetchIA()` retorna um objeto JSON parseado. Os extratores configurados em `dataFetch()` também são aplicados — basta omitir `stream: true` no body:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-..." },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá" }],
        stream: false,
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.message?.content ?? "",
            }),
        },
    ],
});

const result = await stream.fetchIA();

console.log(result.content); // extraído pelo extrator
```

**Com builder (DeepSeek):**

```typescript
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-...").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Olá").build()])
        .stream(false)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.message?.content ?? "",
            }),
        },
    ],
});

const result = await stream.fetchIA();
console.log(result.content);
```

Sem extratores, o JSON cru da API é retornado (ex.: `result.choices[0].message.content`).

---

### Pipe para Arquivo

Defina `encodeBytes: true` para receber chunks como `Uint8Array` — útil para escrever em disco:

```typescript
import { createWriteStream } from "node:fs";

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-..." },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá" }],
        stream: true,
    },
    extractor: [
        { fn: ({ data }) => ({ content: data.choices?.[0]?.delta?.content }) },
    ],
});

const generator = await stream.fetchIA({ encodeBytes: true });

const fileStream = createWriteStream("response.jsonl");
for await (const chunk of generator) {
    fileStream.write(chunk);
}
fileStream.end();
```

---

### Servidor Proxy HTTP

Encaminhe o stream diretamente para um cliente via Bun, Node.js ou Deno:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
});

Bun.serve({
    port: 3000,
    async fetch(req) {
        const body = await req.json();
        const generator = await stream.fetchIA({ encodeBytes: true });
        const aiStream = ReadableStream.from(generator);

        return new Response(aiStream, {
            headers: { "Content-Type": "text/event-stream" },
        });
    },
});
```

---

### Múltiplos Provedores em Paralelo

Cada instância é independente — execute-as concorrentemente:

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-openai-..." },
    timeOut: 30000,
});

import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const deepseekStream = new StreamHttpEvent();
deepseekStream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-deepseek-...").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Olá").build()])
        .stream(true)
        .build(),
    timeOut: 15000,
});

const [openaiResult, deepseekResult] = await Promise.all([
    openaiStream.fetchIA(),
    deepseekStream.fetchIA(),
]);
```

---

## Tipos TypeScript

```typescript
// --- Tipos públicos ---

interface dataFetchType<
    TData extends object,
    TEvent = unknown,
    H extends Record<string, string> = Record<string, string>,
    B extends Record<string, unknown> = Record<string, unknown>,
> {
    url: string;
    headers?: H;
    body?: B;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
    onDone?: (finalData: Record<string, unknown>) => void;
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event?: TEvent;
    }) => Record<string, unknown>;
}
```

---

## Funcionamento Interno

### Buffer

Chunks de rede podem chegar em tamanhos arbitrários, dividindo linhas SSE no meio. O buffer acumula bytes recebidos e só processa linhas completas (terminadas com `\n`). Fragmentos incompletos são mantidos até o próximo chunk chegar.

### Timeout

O timeout é **baseado em inatividade** — ele reseta a cada chunk recebido. Não há limite de duração total. Se nenhum dado chegar durante os `timeOut` milissegundos configurados, o stream é abortado via `throw` e `bodyReader.cancel()`.

### Estados

Dois estados internos rastreiam dados durante o streaming:

| Estado              | Escopo         | Propósito                                                                                                 |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `state`             | Uma linha SSE  | Mantém `data`, `event` e `extracted` parseados para o chunk atual. Limpo após cada yield.                 |
| `stateLongDuration` | Stream inteiro | Acumula `data` (mais recente) e `extractedLongDuration` (merge de todos os chunks). Entregue ao `onDone`. |

### `[DONE]`

O protocolo SSE sinaliza fim do stream com `data: [DONE]`. Quando detectado, `onDone` é chamado com `extractedLongDuration` acumulado e o generator encerra via `return`.

### Cancelamento

Quando o consumidor cancela (via `break` no `for await` ou `AbortSignal`), o bloco `finally` interno limpa o timer de inatividade e libera o lock do `bodyReader`. Nenhum recurso vaza.

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
- [Per-Provider Builders (DeepSeek)](#per-provider-builders-deepseek)
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
    headers: { Authorization: "Bearer sk-your-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true,
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
});

// 2. Request
const generator = await stream.fetchIA();

// 3. Read
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

**With typed builder (DeepSeek):**

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-your-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Hello!").build()])
        .stream(true)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
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

**What problem this solves.** AI providers return streaming responses as raw SSE bytes. Parsing those manually means dealing with buffering, line splitting, `[DONE]` detection, and per-provider response shapes. This library handles all of that and gives you a clean `AsyncGenerator`.

**Two-step pattern.**

1. `dataFetch()` — configure the instance (URL, headers, body, timeout, extractors, `onDone` callback). Call once.
2. `fetchIA()` — execute the request. Returns an `AsyncGenerator` (if the response is `text/event-stream`) or a parsed JSON object (fallback for non-streaming).

**Extractors** are functions `({ data, event? }) => Record<string, unknown>` that map data into the shape you want. In streaming mode, each SSE chunk is processed. In JSON fallback (non-streaming), extractors are applied sequentially over the parsed JSON (no `event`). Without extractors, nothing is yielded to the generator. With extractors, each chunk becomes whatever your function returns.

---

## API Reference

### `dataFetch()`

Configures the instance. Must be called before `fetchIA()`.

```typescript
stream.dataFetch(config: dataFetchType): void
```

| Parameter   | Type                                                        | Required | Description                                                                                                                                   |
| ----------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`       | `string`                                                    | Yes      | AI provider endpoint                                                                                                                          |
| `headers`   | `Record<string, string>` or provider-specific Builder type  | No       | HTTP headers (Authorization, Content-Type, etc.). Automatically typed when using a provider builder.                                          |
| `body`      | `Record<string, unknown>` or provider-specific Builder type | No       | Request body (serialized as JSON). Configure here or use a provider builder for auto-completion of all fields.                                |
| `timeOut`   | `number`                                                    | No       | Inactivity timeout in milliseconds. Resets on each chunk. No total-time limit.                                                                |
| `extractor` | `extractorType[]`                                           | No       | Default extractors for every `fetchIA()` call.                                                                                                |
| `onDone`    | `(finalData: Record<string, unknown>) => void`              | No       | Callback fired when the stream ends. Receives the full accumulated response (merge of all extracted chunks). Useful for saving to a database. |

---

### `fetchIA()`

Executes the HTTP request and returns either an `AsyncGenerator` or a parsed JSON object.

```typescript
stream.fetchIA(options: FetchOptions): Promise<AsyncGenerator | object>
```

| Parameter     | Type          | Required | Description                                                                                   |
| ------------- | ------------- | -------- | --------------------------------------------------------------------------------------------- |
| `method`      | `string`      | No       | HTTP method. Default: `"POST"`                                                                |
| `signal`      | `AbortSignal` | No       | AbortController signal for request cancellation                                               |
| `encodeBytes` | `boolean`     | No       | If `true`, yielded chunks are `Uint8Array`. If `false`/`undefined`, chunks are plain objects. |

**Returns:**

- `AsyncGenerator<Record<string, unknown> | Uint8Array, void, unknown>` — if `Content-Type` is `text/event-stream`. Consume with `for await (const chunk of generator)`.
- `object` — the parsed JSON response for non-streaming requests. If extractors are configured in `dataFetch()`, they are applied sequentially over the JSON.

**Errors:**

- Throws if `dataFetch()` was not called (no URL configured).
- Throws if the HTTP response is not OK (`!fetcher.ok`).
- Throws if the response has no body.

---

### `extractorType`

Each extractor function receives the parsed `data` and `event` (optional) from the current chunk.

```typescript
type extractorType<TData extends object, TEvent = unknown> = {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event?: TEvent;
    }) => Record<string, unknown>;
};
```

**Behavior:**

- `event` is **optional** — absent in non-streaming JSON responses.
- If your function returns `{}` (empty), nothing is yielded for that chunk.
- **Streaming:** multiple extractors run sequentially per line. The **last** extractor's result determines what gets yielded. Values accumulate in `extractedLongDuration` via spread merge (`{ ...old, ...new }`) and are delivered to `onDone` when the stream ends.
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
        Authorization: "Bearer sk-your-token",
    },
    timeOut: 30000,
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explain SSE" }],
        stream: true,
    },
    extractor: [
        {
            fn: ({ data }) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            },
        },
    ],
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

Groq follows the same pattern — it uses an OpenAI-compatible API:

````typescript
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk-your-token",
        "Content-Type": "application/json"
    },
    body: {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Hello" }],
        stream: true
    },
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }]
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

> **Tip:** Groq can also use the [DeepSeek builders](#per-provider-builders-deepseek) — the body format is the same (OpenAI-compatible). Just swap the URL.

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
    body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
        stream: true
    },
    extractor: [{
        fn: ({ data }) => {
            if (data.type === "content_block_delta") {
                return { text: data.delta?.text };
            }
            return {};
        }
    }]
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.text);
}

---

### Per-Provider Builders (DeepSeek / OpenAI-compatible)

Use builders to construct headers and body with exact types and autocomplete — no memorizing keys or typing manually. **Works with any provider that follows the OpenAI format** (Groq, Together AI, Fireworks, etc.), just swap the URL:

> **Compatible with:** Groq, Together AI, Fireworks, Perplexity, xAI, and any API using the `{ messages, model, stream, temperature, ... }` shape. Just adjust the URL in `dataFetch()`.

```typescript
import {
    DeepSeekHeadersBuilder, DeepSeekBodyBuilder, DeepSeekMessageBuilder,
    DeepSeekThinkingBuilder, DeepSeekToolBuilder, DeepSeekToolParametersBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-your-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([
            new DeepSeekMessageBuilder().role("system").content("You are an assistant").build(),
            new DeepSeekMessageBuilder().role("user").content("What's the weather?").build(),
        ])
        .thinking(
            new DeepSeekThinkingBuilder().type("enabled").reasoningEffort("high").build()
        )
        .tools([
            new DeepSeekToolBuilder()
                .name("getWeather")
                .description("Get the current weather for a city")
                .parameters(
                    new DeepSeekToolParametersBuilder()
                        .property("city", { type: "string", description: "City name" })
                        .required("city")
                        .build()
                )
                .build(),
        ])
        .temperature(0.7)
        .stream(true)
        .build(),
    extractor: [{
        fn: ({ data }) => ({
            content: data.choices?.[0]?.delta?.content ?? ""
        })
    }],
});

const generator = await stream.fetchIA();
for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
````

Each builder follows the corresponding interface. If the interface changes, the builder automatically keeps pace. `.build()` returns the exact typed object for `dataFetch()`.

---

### Cancellation

**Via AbortController (before the request starts):**

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const generator = await stream.fetchIA({
    signal: controller.signal,
});

for await (const chunk of generator) {
    console.log(chunk);
}
```

**Via `break` in `for await` (mid-stream):**

```typescript
const generator = await stream.fetchIA();

let count = 0;
for await (const chunk of generator) {
    console.log(chunk);
    count++;
    if (count >= 10) break; // cancels after 10 chunks
}
```

When the consumer cancels via `break` or `AbortSignal`, the internal `bodyReader` is cancelled and the inactivity timeout is cleared automatically via the `finally` block.

---

### Saving the Full Response

Use `onDone` to capture the accumulated data when the stream finishes — ideal for persisting to a database on the backend:

```typescript
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-your-token").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([
            new DeepSeekMessageBuilder()
                .role("user")
                .content("Explain RAG")
                .build(),
        ])
        .stream(true)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? "",
            }),
        },
    ],
    onDone: (finalData) => {
        console.log("Full response:", finalData);
        // await db.messages.update({ response: finalData.content });
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk.content);
}
```

The `finalData` object is the spread-merge of every extracted chunk. Without extractors, `onDone` receives `{}`.

---

### Non-Streaming Fallback

If the response is not `text/event-stream`, `fetchIA()` returns a parsed JSON object. Extractors configured in `dataFetch()` are also applied — simply omit `stream: true` from the body:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-..." },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.message?.content ?? "",
            }),
        },
    ],
});

const result = await stream.fetchIA();

console.log(result.content); // extracted by the extractor
```

**With builder (DeepSeek):**

```typescript
import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

stream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-...").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Hello").build()])
        .stream(false)
        .build(),
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.message?.content ?? "",
            }),
        },
    ],
});

const result = await stream.fetchIA();
console.log(result.content);
```

Without extractors, the raw API JSON is returned (e.g. `result.choices[0].message.content`).

---

### Piping to File

Set `encodeBytes: true` to receive `Uint8Array` chunks — useful for writing to disk:

```typescript
import { createWriteStream } from "node:fs";

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-..." },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
    },
    extractor: [
        { fn: ({ data }) => ({ content: data.choices?.[0]?.delta?.content }) },
    ],
});

const generator = await stream.fetchIA({ encodeBytes: true });

const fileStream = createWriteStream("response.jsonl");
for await (const chunk of generator) {
    fileStream.write(chunk);
}
fileStream.end();
```

---

### HTTP Proxy Server

Forward the stream directly to a client via Bun, Node.js, or Deno:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
});

Bun.serve({
    port: 3000,
    async fetch(req) {
        const body = await req.json();
        const generator = await stream.fetchIA({ encodeBytes: true });
        const aiStream = ReadableStream.from(generator);

        return new Response(aiStream, {
            headers: { "Content-Type": "text/event-stream" },
        });
    },
});
```

---

### Multiple Providers in Parallel

Each instance is independent — run them concurrently:

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-openai-..." },
    timeOut: 30000,
});

import {
    DeepSeekHeadersBuilder,
    DeepSeekBodyBuilder,
    DeepSeekMessageBuilder,
} from "@felipe-lib/stream-http-event/builders-providers/deepseek";

const deepseekStream = new StreamHttpEvent();
deepseekStream.dataFetch({
    url: "https://api.deepseek.com/chat/completions",
    headers: new DeepSeekHeadersBuilder().apiKey("sk-deepseek-...").build(),
    body: new DeepSeekBodyBuilder()
        .model("deepseek-v4-pro")
        .messages([new DeepSeekMessageBuilder().content("Hello").build()])
        .stream(true)
        .build(),
    timeOut: 15000,
});

const [openaiResult, deepseekResult] = await Promise.all([
    openaiStream.fetchIA(),
    deepseekStream.fetchIA(),
]);
```

---

## TypeScript Types

```typescript
// --- Public types ---

interface dataFetchType<
    TData extends object,
    TEvent = unknown,
    H extends Record<string, string> = Record<string, string>,
    B extends Record<string, unknown> = Record<string, unknown>,
> {
    url: string;
    headers?: H;
    body?: B;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
    onDone?: (finalData: Record<string, unknown>) => void;
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event?: TEvent;
    }) => Record<string, unknown>;
}
```

---

## Internals

### Buffer

Network chunks may arrive in arbitrary sizes, splitting SSE lines mid-way. The buffer accumulates incoming bytes and only processes full lines (ending with `\n`). Incomplete fragments are held until the next chunk arrives.

### Timeout

Timeout is **inactivity-based** — it resets on every received chunk. There is no total-duration limit. If no data arrives for the configured `timeOut` milliseconds, the stream is aborted via `throw` and `bodyReader.cancel()`.

### States

Two internal states track data during streaming:

| State               | Scope         | Purpose                                                                                                    |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `state`             | One SSE line  | Holds the parsed `data`, `event`, and `extracted` for the current chunk. Cleared after each yield.         |
| `stateLongDuration` | Entire stream | Accumulates `data` (latest) and `extractedLongDuration` (merged across all chunks). Delivered to `onDone`. |

### `[DONE]`

The SSE protocol signals end-of-stream with `data: [DONE]`. When detected, `onDone` is called with the accumulated `extractedLongDuration`, and the generator exits via `return`.

### Cancellation

When the consumer cancels (via `break` in `for await` or `AbortSignal`), the internal `finally` block clears the inactivity timer and releases the `bodyReader` lock. No resources leak.

---

## License

ISC
