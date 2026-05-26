# @felipe-lib/stream-http-event

A lightweight TypeScript library for consuming **Server-Sent Events (SSE)** over HTTP — built specifically for streaming responses from AI/LLM APIs like OpenAI, Anthropic, and similar services.

## Features

- Sends HTTP POST requests with custom headers and body
- Parses `text/event-stream` (SSE) responses in real-time via `ReadableStream`
- Handles partial/incomplete chunks across network boundaries with an internal buffer
- Applies a user-defined **extractor** to transform raw `data:` lines into structured objects
- Detects `[DONE]` as the stream termination signal
- Optionally encodes output as `Uint8Array` bytes (ideal for piping into further streams)
- Falls back to `response.json()` for non-streaming responses

## Installation

```bash
npm install @felipe-lib/stream-http-event
```

or

```bash
pnpm add @felipe-lib/stream-http-event
```

## Quick Start

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

## API Reference

### `StreamHttpEvent`

Main class for streaming HTTP event handling.

---

#### `dataFetch(options)`

Configures the fetch request and the extraction logic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The endpoint URL |
| `headers` | `Record<string, string>` | No | HTTP headers (e.g., `Authorization`, `Content-Type`) |
| `body` | `any` | No | Request body — typically `JSON.stringify(...)` |
| `extractor` | `(data: string) => any` | Yes | Transforms each parsed `data:` line into the desired output format |

---

#### `fetchIA(options): Promise<ReadableStream<Uint8Array> | Body>`

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

## License

ISC
