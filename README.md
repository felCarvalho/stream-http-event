# @felipe-lib/stream-http-event

[![npm version](https://img.shields.io/badge/npm-v1.4.5-blue)](https://www.npmjs.com/package/@felipe-lib/stream-http-event)
[![license](https://img.shields.io/badge/license-ISC-green)](./LICENSE)

**Zero runtime dependencies.** Consume streaming HTTP responses from AI providers (OpenAI, Anthropic, Groq, DeepSeek, etc.) via the [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) protocol.

Works in any runtime with `fetch`, `ReadableStream`, `TextDecoder`, and `TextEncoder` — browsers, Node.js 18+, Deno, Bun, Cloudflare Workers.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [`dataFetch()`](#datafetch)
  - [`fetchIA()`](#fetchia)
  - [`extractorType`](#extractortype)
- [Guides](#guides)
  - [Basic Streaming (OpenAI / Groq)](#basic-streaming-openai--groq)
  - [Per-Provider Extractors (Anthropic)](#per-provider-extractors-anthropic)
  - [Cancellation](#cancellation)
  - [Saving the Full Response](#saving-the-full-response)
  - [Non-Streaming Fallback](#non-streaming-fallback)
  - [Piping to File](#piping-to-file)
  - [HTTP Proxy Server](#http-proxy-server)
  - [Multiple Providers in Parallel](#multiple-providers-in-parallel)
- [TypeScript Types](#typescript-types)
- [Internals](#internals)
- [License](#license)

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

**Extractors** are functions `({ data, event }) => Record<string, unknown>` that map each SSE chunk into the shape you want. Without extractors, nothing is enqueued to the stream. With extractors, each chunk becomes whatever your function returns.

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
- `object` — the parsed JSON response for non-streaming requests

**Errors:**
- Throws if `dataFetch()` was not called (no URL configured).
- Throws if the HTTP response is not OK (`!fetcher.ok`).
- Throws if the response has no body.

---

### `extractorType`

Each extractor function receives the parsed `data` and `event` from the current SSE line.

```typescript
type extractorType<TData extends object, TEvent = unknown> = {
    fn: ({ data, event }: { data: TData; event: TEvent }) => Record<string, unknown>;
};
```

**Behavior:**
- Both `data` and `event` are always passed — you choose which to use.
- If your function returns `{}` (empty), nothing is enqueued for that chunk.
- Multiple extractors run sequentially per line. The **last** extractor's result determines what gets enqueued.
- Values accumulate in `extractedLongDuration` via spread merge (`{ ...old, ...new }`) and are delivered to `onDone` when the stream ends.

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

If the response is not `text/event-stream`, `fetchIA()` returns a plain parsed JSON object:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
    })
});

console.log(result.choices[0].message.content);
```

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
    fn: ({ data, event }: { data: TData; event: TEvent }) => Record<string, unknown>;
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
