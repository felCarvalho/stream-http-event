# @felipe-lib/stream-http-event

*[English](#english) | [Português](#português)*

---

## English

A lightweight TypeScript library for consuming **Server-Sent Events (SSE)** over HTTP — built specifically for streaming responses from AI/LLM APIs.

### Features

- Configurable HTTP method (defaults to `POST`), headers and body
- Parses `text/event-stream` (SSE) responses in real-time via `ReadableStream`
- Handles partial/incomplete chunks across network boundaries with an internal buffer
- User-defined **extractor** to transform raw `data:` lines into structured objects (optional, falls back to raw data)
- Detects `[DONE]` as the stream termination signal
- Optional `timeOut` to abort hanging connections (resets on each received chunk)
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

// 1. Static config — reusable across multiple fetchIA() calls
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    timeOut: 30000, // 30s timeout, resets on each chunk received
});

// 2. Execute — pass per-request options (body, method, extractor)
// With encodeBytes: true — each chunk is encoded as Uint8Array
const stream = await streamer.fetchIA({
    encodeBytes: true,
    method: "POST",
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

Configures the static request parameters. **Must be called before `fetchIA()`.** Can be called once and reused across multiple `fetchIA()` calls.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The endpoint URL |
| `headers` | `Record<string, string>` | No | HTTP headers (e.g., `Authorization`, `Content-Type`) |
| `timeOut` | `number` | No | Max milliseconds without a chunk before aborting. Resets on each received chunk. If `0` or omitted, no timeout is enforced. |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | null | Body>`

Executes the HTTP request. If the response `Content-Type` is `text/event-stream`, returns a `ReadableStream` with parsed events. Otherwise, falls back to `response.json()`.

Throws an error if `dataFetch()` was not called beforehand.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `encodeBytes` | `boolean` | No | If `true`, each extracted chunk is `JSON.stringify()`-ed, suffixed with `\n`, and encoded as `Uint8Array`. If `false` or omitted, values are enqueued as plain strings. |
| `signal` | `AbortSignal` | No | Passed to the underlying `fetch()` call. Aborting the signal cancels the HTTP request and the stream reader. |
| `method` | `string` | No | HTTP method for the request. Defaults to `"POST"`. |
| `body` | `any` | No | Request body. Typically `JSON.stringify(...)`. Defaults to `"{}"`. |
| `extractor` | `(data: string) => any` | No | Transforms each parsed `data:` line into the desired output format. If omitted, the raw `data:` content is enqueued as-is. |

---

### Usage Examples

All examples below use `encodeBytes: false` for readability — swap to `true` if you need `Uint8Array` output.

#### OpenAI (ChatGPT / GPT-4)

```typescript
const streamer = new StreamHttpEvent();
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    timeOut: 30000,
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Explain quantum computing in one paragraph." }],
        stream: true,
        temperature: 0.7,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### Anthropic (Claude)

Claude SSE emits typed events — `content_block_delta` carries the text. Other event types (e.g. `message_start`, `message_stop`) should be skipped.

```typescript
streamer.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Explain quantum computing." }],
        stream: true,
    }),
    extractor: (data) => {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta") {
            return parsed.delta?.text ?? "";
        }
        return "";
    },
});
```

#### Google (Gemini)

Gemini uses a query parameter for the API key and a different request/response shape.

```typescript
streamer.dataFetch({
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`,
    headers: { "Content-Type": "application/json" },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        contents: [{ parts: [{ text: "Explain quantum computing." }] }],
    }),
    extractor: (data) => {
        const parsed = JSON.parse(data);
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
});
```

#### Groq (OpenAI-compatible)

```typescript
streamer.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: "Explain quantum computing." }],
        stream: true,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### DeepSeek (OpenAI-compatible)

```typescript
streamer.dataFetch({
    url: "https://api.deepseek.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Explain quantum computing." }],
        stream: true,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### Cancel with AbortController

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // cancel after 10s

const stream = await streamer.fetchIA({
    signal: controller.signal,
    body: JSON.stringify({ model: "gpt-4", messages: [...], stream: true }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
// stream.getReader().read() will reject with AbortError after 10s
```

#### Express.js endpoint — relay AI stream to browser

```typescript
app.get("/chat", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const streamer = new StreamHttpEvent();
    streamer.dataFetch({
        url: "https://api.openai.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    const stream = await streamer.fetchIA({
        encodeBytes: false,
        body: JSON.stringify({ model: "gpt-4", messages: [...], stream: true }),
        extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
    });

    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(`data: ${JSON.stringify({ content: value })}\n\n`);
        }
    } finally {
        res.end();
        reader.releaseLock();
    }

    req.on("close", () => reader.cancel());
});
```

---

### Internal Buffer — How It Works

SSE streams are delivered over HTTP as a continuous flow of bytes. Network packets can split a `data:` line mid-stream, so the library uses an **internal buffer** to reconstruct complete lines before processing them.

#### The Problem

A single SSE event like `data: {"token":"hello"}\n\n` may arrive in two separate network chunks:

```
// Chunk 1: "data: {\"tok"
// Chunk 2: "en\":\"hello\"}\n\n"
```

Without buffering, chunk 1 would be unparseable garbage.

#### How the Buffer Solves It

```
┌──────────────┐     ┌─────────────────┐     ┌────────────┐     ┌──────────────┐
│  Network     │     │ bufferControl() │     │ serialize()│     │ ReadableStream│
│  Chunks      │────▶│  Accumulates    │────▶│ Splits by  │────▶│ enqueue()     │
│  (Uint8Array)│     │  raw text       │     │ \n, keeps  │     │ one per event │
└──────────────┘     └─────────────────┘     │ remainder  │     └──────────────┘
                                             └────────────┘
```

**Step by step:**

1. **Accumulate** — each network chunk is decoded to text (`TextDecoder`) and appended to the internal buffer (`buffer.add(data)`).

2. **Split** — `serialize()` splits the buffer by `\n`, producing an array of lines.

3. **Preserve remainder** — the last element after splitting is kept in the buffer (`buffer.setBuffer(lines.pop())`). This is the key: if a line was incomplete, it stays in the buffer and waits for the next chunk to complete it. If the line was complete, `lines.pop()` returns an empty string (harmless).

4. **Process** — complete lines are iterated: `data:` lines have their prefix stripped and are passed to your `extractor`. Empty lines and other SSE fields (like `event:`, `id:`) are skipped.

5. **Enqueue** — each extracted value is pushed into the output `ReadableStream`. Only `[DONE]` closes the stream early.

```
Example with encodeBytes: true

Buffer state across chunks:
─────────────────────────────────────────────────
Chunk arrives: "data: hello\n"
  → buffer = "data: hello\n"
  → split by \n → ["data: hello", ""]
  → pop "" → buffer = ""
  → enqueue encoder.encode('"hello"\n')  ✅ Uint8Array

Chunk arrives: "data: wo"
  → buffer = "data: wo"
  → split by \n → ["data: wo"]
  → pop "data: wo" → buffer = "data: wo"  ⏳ waits

Chunk arrives: "rld\n"
  → buffer = "data: world\n"
  → split by \n → ["data: world", ""]
  → pop "" → buffer = ""
  → enqueue encoder.encode('"world"\n')  ✅ Uint8Array
```

#### Key Takeaway

> The buffer is **internal and automatic**. You never interact with it directly. It exists solely to handle network fragmentation and is **independent of the `encodeBytes` setting** — it works the same way whether you choose `true` or `false`.

### Build

```bash
pnpm build
```

Uses TypeScript (`ES2020` / `ESM` output) targeting `DOM` + `ES2020` types.

---

### Internal Flow

Every `fetchIA()` call follows this execution pipeline:

```
dataFetch()  →  fetchIA()  →  fetch()  →  streamIA()  →  ReadableStream
  (config)       (request)     (HTTP)      (factory)       (output)
```

**1. `dataFetch(url, headers, timeOut)`**
Stores static config in instance fields. No request is made. Can be called once and reused across multiple `fetchIA()` calls.

**2. `fetchIA({ encodeBytes, signal, method, body, extractor })`**
Validates that `url` is set, then calls `fetch()` with the configured parameters. Checks response status and content type:
- `text/event-stream` → delegates to `streamIA()` to create the output stream
- Any other content type → falls back to `response.json()`

**3. `streamIA(body, encodeBytes, extractor)`**
Creates the output `ReadableStream`. Internally sets up:
- `bodyReader` — reads raw network chunks from the HTTP response
- `bufferControl` — accumulator for partial SSE lines
- `timeOutControl` — manages `setTimeout`/`clearTimeout`
- `TextDecoder`/`TextEncoder` — text ↔ bytes conversion

**4. Read loop** (inside the `ReadableStream` callback)
```
start timeout → while(true):
  read chunk from network
  decode Uint8Array → text, append to buffer
  reset timeout (each chunk extends the deadline)
  serialize() — process complete SSE lines
  if [DONE] → clear timeout, close stream
on error → clear timeout, propagate error
finally → release reader lock
```

**5. `serialize(buffer, controller, encoder, extractor, encodeBytes)`**
```
buffer.split("\n")          → split accumulated text into lines
lines.pop() → back to buffer → keep incomplete line for next chunk

for each complete line:
  empty line?        → skip
  contains [DONE]?   → close stream, return
  starts with data:? → strip prefix, call extractor (or use raw)
                        encodeBytes?
                          true  → enqueue Uint8Array with trailing \n
                          false → enqueue plain string
```

**6. `timeout(controller, timeOutId, bodyReader)`**
```
if active timer exists → clear it
if this.timeOut > 0 → setTimeout(timeOut ms):
  controller.error()   → terminates output stream
  bodyReader.cancel()  → closes network read
```
Both `error()` and `cancel()` together kill the connection to the AI provider.

---

---

## Português

Uma biblioteca TypeScript leve para consumir **Server-Sent Events (SSE)** sobre HTTP — criada para respostas em streaming de APIs de IA/LLM.

### Funcionalidades

- Método HTTP configurável (padrão `POST`), headers e body
- Faz parse de respostas `text/event-stream` (SSE) em tempo real via `ReadableStream`
- Lida com chunks parciais/incompletos com um buffer interno
- **Extractor** definido pelo usuário para transformar linhas `data:` em objetos estruturados (opcional, fallback para dado bruto)
- Detecta `[DONE]` como sinal de término do stream
- `timeOut` opcional para abortar conexões travadas (reseta a cada chunk recebido)
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

// 1. Configuração estática — reutilizável em várias chamadas fetchIA()
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    timeOut: 30000, // 30s de timeout, reseta a cada chunk recebido
});

// 2. Executar — opções por requisição (body, method, extractor)
// Com encodeBytes: true — cada chunk é codificado como Uint8Array
const stream = await streamer.fetchIA({
    encodeBytes: true,
    method: "POST",
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

Configura os parâmetros estáticos da requisição. **Deve ser chamado antes de `fetchIA()`.** Pode ser chamado uma vez e reutilizado em múltiplas chamadas `fetchIA()`.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `url` | `string` | Sim | A URL do endpoint |
| `headers` | `Record<string, string>` | Não | Cabeçalhos HTTP (ex.: `Authorization`, `Content-Type`) |
| `timeOut` | `number` | Não | Milissegundos máximos sem chunk antes de abortar. Reseta a cada chunk recebido. Se `0` ou omitido, sem timeout. |

---

##### `fetchIA(options): Promise<ReadableStream<Uint8Array> | null | Body>`

Executa a requisição HTTP. Se o `Content-Type` for `text/event-stream`, retorna uma `ReadableStream` com os eventos processados. Caso contrário, faz fallback para `response.json()`.

Lança erro se `dataFetch()` não tiver sido chamado antes.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `encodeBytes` | `boolean` | Não | Se `true`, cada chunk é serializado com `JSON.stringify()`, sufixado com `\n` e codificado como `Uint8Array`. Se `false` ou omitido, os valores são enfileirados como strings. |
| `signal` | `AbortSignal` | Não | Repassado ao `fetch()` interno. Abortar o sinal cancela a requisição HTTP e o leitor do stream. |
| `method` | `string` | Não | Método HTTP da requisição. Padrão `"POST"`. |
| `body` | `any` | Não | Corpo da requisição. Normalmente `JSON.stringify(...)`. Padrão `"{}"`. |
| `extractor` | `(data: string) => any` | Não | Transforma cada linha `data:` no formato de saída desejado. Se omitido, o conteúdo bruto do `data:` é enfileirado como está. |

---

### Exemplos de Uso

Todos os exemplos abaixo usam `encodeBytes: false` para legibilidade — troque para `true` se precisar de saída `Uint8Array`.

#### OpenAI (ChatGPT / GPT-4)

```typescript
const streamer = new StreamHttpEvent();
streamer.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    timeOut: 30000,
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Explique computação quântica em um parágrafo." }],
        stream: true,
        temperature: 0.7,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### Anthropic (Claude)

O SSE do Claude emite eventos com tipos — `content_block_delta` carrega o texto. Outros tipos (`message_start`, `message_stop`) devem ser ignorados.

```typescript
streamer.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Explique computação quântica." }],
        stream: true,
    }),
    extractor: (data) => {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta") {
            return parsed.delta?.text ?? "";
        }
        return "";
    },
});
```

#### Google (Gemini)

O Gemini usa query parameter para a API key e formato diferente de request/response.

```typescript
streamer.dataFetch({
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`,
    headers: { "Content-Type": "application/json" },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        contents: [{ parts: [{ text: "Explique computação quântica." }] }],
    }),
    extractor: (data) => {
        const parsed = JSON.parse(data);
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
});
```

#### Groq (compatível com OpenAI)

```typescript
streamer.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: "Explique computação quântica." }],
        stream: true,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### DeepSeek (compatível com OpenAI)

```typescript
streamer.dataFetch({
    url: "https://api.deepseek.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
});

const stream = await streamer.fetchIA({
    encodeBytes: false,
    body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Explique computação quântica." }],
        stream: true,
    }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
```

#### Cancelar com AbortController

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // cancela após 10s

const stream = await streamer.fetchIA({
    signal: controller.signal,
    body: JSON.stringify({ model: "gpt-4", messages: [...], stream: true }),
    extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
});
// stream.getReader().read() rejeitará com AbortError após 10s
```

#### Endpoint Express.js — retransmitir stream da IA para o navegador

```typescript
app.get("/chat", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const streamer = new StreamHttpEvent();
    streamer.dataFetch({
        url: "https://api.openai.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    const stream = await streamer.fetchIA({
        encodeBytes: false,
        body: JSON.stringify({ model: "gpt-4", messages: [...], stream: true }),
        extractor: (data) => JSON.parse(data).choices?.[0]?.delta?.content ?? "",
    });

    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(`data: ${JSON.stringify({ content: value })}\n\n`);
        }
    } finally {
        res.end();
        reader.releaseLock();
    }

    req.on("close", () => reader.cancel());
});
```

---

### Buffer Interno — Como Funciona

Streams SSE são entregues via HTTP como um fluxo contínuo de bytes. Pacotes de rede podem dividir uma linha `data:` no meio do caminho, então a biblioteca usa um **buffer interno** para reconstruir linhas completas antes de processá-las.

#### O Problema

Um único evento SSE como `data: {"token":"olá"}\n\n` pode chegar em dois chunks de rede separados:

```
// Chunk 1: "data: {\"tok"
// Chunk 2: "en\":\"olá\"}\n\n"
```

Sem o buffer, o chunk 1 seria lixo impossível de interpretar.

#### Como o Buffer Resolve

```
┌──────────────┐     ┌─────────────────┐     ┌────────────┐     ┌──────────────┐
│  Chunks de   │     │ bufferControl() │     │ serialize()│     │ ReadableStream│
│  Rede        │────▶│  Acumula texto  │────▶│ Divide por │────▶│ enqueue()     │
│  (Uint8Array)│     │  bruto          │     │ \n, guarda │     │ um por evento │
└──────────────┘     └─────────────────┘     │ o resto    │     └──────────────┘
                                             └────────────┘
```

**Passo a passo:**

1. **Acumular** — cada chunk de rede é decodificado para texto (`TextDecoder`) e anexado ao buffer interno (`buffer.add(data)`).

2. **Dividir** — `serialize()` divide o buffer por `\n`, produzindo um array de linhas.

3. **Preservar o resto** — o último elemento após a divisão é mantido no buffer (`buffer.setBuffer(lines.pop())`). Este é o segredo: se uma linha estava incompleta, ela fica no buffer e aguarda o próximo chunk para se completar. Se a linha já estava completa, `lines.pop()` retorna uma string vazia (inofensivo).

4. **Processar** — as linhas completas são iteradas: o prefixo `data:` é removido e o conteúdo é passado ao seu `extractor`. Linhas vazias e outros campos SSE (como `event:`, `id:`) são ignorados.

5. **Enfileirar** — cada valor extraído é empurrado para a `ReadableStream` de saída. Apenas `[DONE]` fecha o stream antes da hora.

```
Exemplo com encodeBytes: true

Estado do buffer ao longo dos chunks:
─────────────────────────────────────────────────
Chegou chunk: "data: olá\n"
  → buffer = "data: olá\n"
  → divide por \n → ["data: olá", ""]
  → pop "" → buffer = ""
  → enqueue encoder.encode('"olá"\n')  ✅ Uint8Array

Chegou chunk: "data: mu"
  → buffer = "data: mu"
  → divide por \n → ["data: mu"]
  → pop "data: mu" → buffer = "data: mu"  ⏳ aguarda

Chegou chunk: "ndo\n"
  → buffer = "data: mundo\n"
  → divide por \n → ["data: mundo", ""]
  → pop "" → buffer = ""
  → enqueue encoder.encode('"mundo"\n')  ✅ Uint8Array
```

#### Resumo

> O buffer é **interno e automático**. Você nunca interage com ele diretamente. Ele existe apenas para lidar com a fragmentação da rede e é **independente da configuração `encodeBytes`** — funciona da mesma forma seja `true` ou `false`.

### Build

```bash
pnpm build
```

Usa TypeScript (`ES2020` / `ESM`), com target `DOM` + `ES2020`.

---

### Fluxo Interno

Cada chamada `fetchIA()` segue este pipeline de execução:

```
dataFetch()  →  fetchIA()  →  fetch()  →  streamIA()  →  ReadableStream
  (config)       (requisição)  (HTTP)      (fábrica)       (saída)
```

**1. `dataFetch(url, headers, timeOut)`**
Armazena a config estática nos campos da instância. Nenhuma requisição é feita. Pode ser chamado uma vez e reutilizado em múltiplos `fetchIA()`.

**2. `fetchIA({ encodeBytes, signal, method, body, extractor })`**
Valida se `url` está definida, depois chama `fetch()` com os parâmetros configurados. Verifica status e content-type da resposta:
- `text/event-stream` → delega para `streamIA()` criar o stream de saída
- Outro content-type → fallback para `response.json()`

**3. `streamIA(body, encodeBytes, extractor)`**
Cria o `ReadableStream` de saída. Internamente configura:
- `bodyReader` — lê chunks brutos da rede da resposta HTTP
- `bufferControl` — acumulador de linhas SSE parciais
- `timeOutControl` — gerencia `setTimeout`/`clearTimeout`
- `TextDecoder`/`TextEncoder` — conversão texto ↔ bytes

**4. Loop de leitura** (dentro do callback do `ReadableStream`)
```
inicia timeout → while(true):
  lê chunk da rede
  decodifica Uint8Array → texto, anexa ao buffer
  reinicia timeout (cada chunk estende o prazo)
  serialize() — processa linhas SSE completas
  se [DONE] → limpa timeout, fecha stream
em erro → limpa timeout, propaga erro
finally → libera lock do reader
```

**5. `serialize(buffer, controller, encoder, extractor, encodeBytes)`**
```
buffer.split("\n")          → divide o texto acumulado por linhas
lines.pop() → volta ao buffer → guarda linha incompleta para o próximo chunk

para cada linha completa:
  linha vazia?      → pula
  contém [DONE]?    → fecha stream, retorna
  começa com data:? → remove prefixo, chama extractor (ou usa raw)
                       encodeBytes?
                         true  → enqueue Uint8Array com \n no final
                         false → enqueue string pura
```

**6. `timeout(controller, timeOutId, bodyReader)`**
```
se timer ativo existe → limpa
se this.timeOut > 0 → setTimeout(timeOut ms):
  controller.error()   → encerra o stream de saída
  bodyReader.cancel()  → fecha a leitura da rede
```
`error()` e `cancel()` juntos matam a conexão com o provedor de IA.

---

---

## License

ISC
