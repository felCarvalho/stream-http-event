# @felipe-lib/stream-http-event

---

## Portugues

### Visao Geral

`@felipe-lib/stream-http-event` e uma biblioteca TypeScript **zero dependencias externas de runtime** para consumir respostas HTTP em streaming de provedores de IA (OpenAI, Anthropic, Groq, etc.) que utilizam o protocolo **Server-Sent Events (SSE)** com `text/event-stream`.

A biblioteca encapsula a API nativa `fetch` e transforma o fluxo bruto de bytes SSE em uma **`ReadableStream`** de objetos JSON parseados, com suporte a extracao de campos, timeout por inatividade e dupla codificacao (bytes ou objeto).

**Ambientes suportados:** Navegadores modernos, Node.js 18+, Deno, Bun, Cloudflare Workers — qualquer runtime que suporte `fetch`, `ReadableStream`, `TextDecoder` e `TextEncoder`.

---

### Instalacao

```bash
npm install @felipe-lib/stream-http-event
# ou
pnpm add @felipe-lib/stream-http-event
```

---

### API

#### `dataFetch(config): void`

Configura a instancia antes das chamadas. Deve ser chamada antes de `fetchIA()`.

```typescript
type dataFetchType = {
    url: string;                          // URL do endpoint da IA
    headers?: Record<string, string>;     // Headers HTTP (ex: Authorization)
    timeOut?: number;                     // Timeout de inatividade em ms
    extractor?: extractorType[];          // Extractors padrao
}
```

#### `fetchIA(options): Promise<ReadableStream | object>`

Executa a requisicao HTTP. Se o `content-type` da resposta incluir `text/event-stream`, retorna uma `ReadableStream`. Caso contrario, faz parse como JSON.

```typescript
type FetchOptions = {
    signal?: AbortSignal;        // Cancelamento via AbortController
    encodeBytes?: boolean;       // true = Uint8Array, false/undefined = objeto
    method?: string;             // Metodo HTTP (padrao: "POST")
    body?: string;               // Corpo da requisicao (string JSON)
    extractor?: extractorType[]; // Extractors desta chamada (sobrescreve padrao)
}
```

---

### Como o Buffer Funciona

O buffer resolve o problema de chunks de rede que chegam em tamanhos arbitrarios, cortando linhas SSE no meio.

#### Coracao do buffer (`bufferControl`)

```typescript
private bufferControl() {
    let buffer = "";
    return {
        getBuffer: () => buffer,
        setBuffer: (data: string) => { buffer = data; },
        add: (data: string) => { buffer += data; },
    };
}
```

#### Algoritmo de serializacao

No metodo `serialize()`:

```typescript
const lines = buffer.getBuffer().split("\n");
buffer.setBuffer(lines.pop() ?? "");
```

- `.split("\n")` divide o buffer inteiro por quebras de linha
- `lines.pop()` remove e **retorna o ultimo elemento** — possivelmente uma linha incompleta que ainda nao recebeu seu `\n`
- As linhas restantes sao **completas** (terminadas por `\n`)
- O fragmento incompleto volta ao buffer via `setBuffer()`, aguardando o proximo chunk

#### Exemplo passo a passo

```
ESTADO INICIAL: buffer = ""

--- Chunk 1: "data: {\"content\":\"Hel" ---
buffer.add() → "data: {\"content\":\"Hel"
split("\n") → ["data: {\"content\":\"Hel"]
lines.pop() → "data: {\"content\":\"Hel" (volta ao buffer)
Nenhuma linha completa para processar.

--- Chunk 2: "lo\"}\n\ndata: {\"content\":\"Wo" ---
buffer antes: "data: {\"content\":\"Hel"
buffer.add() → "data: {\"content\":\"Hello\"}\n\ndata: {\"content\":\"Wo"
split("\n") → ["data: {\"content\":\"Hello\"}", "", "data: {\"content\":\"Wo"]
lines.pop() → "data: {\"content\":\"Wo" (incompleta, volta ao buffer)
Linhas completas:
  "data: {\"content\":\"Hello\"}" → JSON.parse → enfileirado
  "" (linha vazia) → ignorada

--- Chunk 3: "rld\"}\n\ndata: [DONE]\n\n" ---
buffer antes: "data: {\"content\":\"Wo"
buffer.add() → "data: {\"content\":\"World\"}\n\ndata: [DONE]\n\n"
split("\n") → ["data: {\"content\":\"World\"}", "", "data: [DONE]", ""]
lines.pop() → "" (vazia, inofensiva)
Linhas completas:
  "data: {\"content\":\"World\"}" → enfileirado
  "data: [DONE]" → detectado → stream fechado
```

---

### Sistema de Extractors

Extractors transformam o formato bruto da resposta da IA em objetos customizados.

**Definicao do tipo:**

```typescript
interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event: TEvent;
    }) => Record<string, unknown>;
}
```

**Exemplo com OpenAI:**

```typescript
const extractors: extractorType[] = [
    {
        fn: ({ data }) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    },
    {
        fn: ({ data }) => {
            const role = data.choices?.[0]?.delta?.role;
            return role ? { role } : {};
        }
    }
];
```

**Comportamento:**
- Cada `fn()` recebe o JSON parseado do campo `data:` e o evento parseado do campo `event:`
- O resultado de cada `fn()` e armazenado sob a chave `"extracted"` no estado — extractors posteriores **sobrescrevem** o valor desta chave (comportamento intencional, cada chunk e independente)
- Se ao final do loop `state.hasStateByKey("extracted")` for `true`, o valor e enfileirado **no lugar** do JSON bruto
- O estado e limpo entre cada linha processada

**O que chega no stream sem extractor:**

Nada e enfileirado — apenas o `stateLongDuration` acumula os dados brutos para uso futuro.

**O que chega no stream com extractor:**

```json
{"content":"Ola","role":"assistant"}
```

Em vez do JSON bruto completo da OpenAI.

---

### Estado Local e Longa Duracao

Dois estados independentes sao criados no `streamIA()`:

| Estado | Escopo | Proposito |
|--------|--------|-----------|
| `state` | Uma linha SSE | Acumula `data`, `event` e `extracted` para a linha atual, limpo apos enfileirar |
| `stateLongDuration` | Stream inteiro | Acumula `data` (ultimo valor) e `extractedLongDuration` (merge `{...antigo, ...novo}`) entre chunks — para uso futuro |

**Algoritmo de estado + extractor por linha:**

```
1. parseAndExtracted():
   - Extrai o valor apos "data: " ou "event: "
   - JSON.parse → armazena no state
   - Para cada extractor: fn({ data, event }) → state.setState({ extracted: resultado })
   - Se extractor.length > 0 e (data ou event existem): loop de extractors

2. serialize():
   - Se state.hasStateByKey("extracted"):
     - Le o extracted do state
     - Le o accumulated de stateLongDuration ("extractedLongDuration")
     - stateLongDuration.setState({ extractedLongDuration: { ...antigo, ...novo } })
     - Enfileira: encodeBytes ? encoder.encode(JSON.stringify(extracted)) : extracted
     - state.clearState()
```

---

### Mecanismo de Timeout

Timeout **baseado em inatividade** entre chunks — nao limita o tempo total da requisicao. O timer reseta a cada chunk recebido.

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 10000  // 10 segundos de inatividade
});
```

**Comportamento:**
1. Timer inicia ao receber o primeiro chunk
2. Cada novo chunk reseta o timer
3. Se expirar: `controller.error(new Error(...))` + `bodyReader.cancel()`
4. Se o stream terminar normalmente (`[DONE]` ou fim do body): timer e limpo

**Implementacao:** metodos `timeout()` e `timeOutControl()`.

---

### Modos de Encoding (`encodeBytes`)

| `encodeBytes` | Tipo de cada chunk | Uso |
|---|---|---|
| `false` ou `undefined` | `object` (objeto parseado) | Consumo direto, log, debug |
| `true` | `Uint8Array` | Piping, gravacao em arquivo, consumo binario |

---

### Deteccao de `[DONE]`

O protocolo SSE sinaliza fim de stream com `data: [DONE]`. O `serialize()` detecta essa linha, chama `controller.close()` e retorna `true`, encerrando o loop de leitura.

---

### Fluxo Completo de Dados

```
fetchIA()
 ├─ fetch(url, { method, headers, body, signal })
 ├─ !fetcher.ok → throw Error(status)
 ├─ !fetcher.body → throw Error
 ├─ content-type inclui "text/event-stream"?
 │   ├─ SIM → streamIA()
 │   │   ├─ body.getReader()
 │   │   ├─ bufferControl() → acumula bytes decodificados
 │   │   ├─ timeOutControl() → gerencia setTimeout
 │   │   ├─ stateLocal() × 2 → state + stateLongDuration
 │   │   └─ ReadableStream:
 │   │       └─ while(true):
 │   │           ├─ bodyReader.read()
 │   │           ├─ done? → close stream, break
 │   │           ├─ decoder.decode(value)
 │   │           ├─ buffer.add()
 │   │           ├─ timeout() → reseta timer
 │   │           └─ serialize():
 │   │               ├─ split("\n") → pop linha incompleta
 │   │               ├─ for each line:
 │   │               │   ├─ "data: [DONE]" → close, return true
 │   │               │   ├─ startsWith("data:") → parseAndExtracted(eventName="data")
 │   │               │   ├─ startsWith("event:") → parseAndExtracted(eventName="event")
 │   │               │   └─ hasStateByKey("extracted")?
 │   │               │       ├─ extrai + acumula em stateLongDuration
 │   │               │       ├─ encodeBytes? enfileira bytes : enfileira objeto
 │   │               │       └─ state.clearState()
 │   │               └─ return false
 │   └─ NAO → fetcher.json()
```

---

### Casos de Uso

#### 1. Streaming de chat com OpenAI

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-seu-token"
    },
    timeOut: 30000,
    extractor: [
        {
            fn: ({ data }) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            }
        }
    ]
});

async function main() {
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
        process.stdout.write((value as { content: string }).content);
    }
    console.log("\n--- Fim ---");
}

main();
```

#### 2. Streaming com cancelamento (AbortController)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 60000
});

const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Conte uma historia longa" }],
        stream: true
    }),
    signal: controller.signal
});
```

#### 3. Streaming com Anthropic (Claude)

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
    extractor: [
        {
            fn: ({ data }) => {
                if (data.type === "content_block_delta") {
                    return { text: data.delta?.text };
                }
                return {};
            }
        }
    ]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Ola" }],
        stream: true
    })
}) as ReadableStream<{ text: string }>;
```

#### 4. Groq

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk_seu-token",
        "Content-Type": "application/json"
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        }
    ]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Qual a capital do Brasil?" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;
```

#### 5. Consumo sem streaming (fallback JSON)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Ola" }],
        stream: false
    })
});

console.log(result.choices[0].message.content);
```

#### 6. Muttiplos extractors

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        },
        {
            fn: ({ data }) => ({
                finish_reason: data.choices?.[0]?.finish_reason ?? ""
            })
        }
    ]
});
// Cada chunk enfileirado: ultimo extractor define o formato
```

#### 7. Piping para arquivo (`encodeBytes: true`)

```typescript
const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Gere um JSON grande" }],
        stream: true
    }),
    encodeBytes: true
}) as ReadableStream<Uint8Array>;

// Node.js
import { createWriteStream } from "node:fs";
const writeStream = createWriteStream("output.jsonl");
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    writeStream.write(value);
}
writeStream.end();
```

#### 8. Servidor HTTP proxy do stream (Bun)

```typescript
const stream = new StreamHttpEvent();
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

#### 9. Processamento em lote com muttiplos provedores

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
    openaiStream.fetchIA({
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Resuma: o que e IA?" }],
            stream: true
        })
    }),
    groqStream.fetchIA({
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Resuma: o que e IA?" }],
            stream: true
        })
    })
]);
```

---

### Tipos TypeScript

```typescript
// src/type.ts

interface bufferControlType {
    getBuffer: () => string;
    setBuffer: (data: string) => void;
    add: (data: string) => void;
}

interface timeOutControlType {
    getTime: () => ReturnType<typeof setTimeout> | undefined;
    setTime: ({ id }: { id: ReturnType<typeof setTimeout> }) => void;
    clearTime: () => void;
}

interface stateLocalType {
    getState: () => unknown | Record<string, unknown>;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event: TEvent;
    }) => Record<string, unknown>;
}

interface dataFetchType<TData extends object, TEvent = unknown> {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType<TData, TEvent>[];
}
```

---

### Estrutura do Projeto

```
.
├── src/
│   ├── streamHttpEvent.ts    # Classe principal
│   └── type.ts               # Definicoes de tipos
├── dist/                     # Saida compilada (ES2022 ESM)
├── package.json
├── tsconfig.json             # target: ES2022, module: ES2022, strict: true
└── README.md
```

### Licenca

ISC

---

## English

### Overview

`@felipe-lib/stream-http-event` is a lightweight, **zero runtime dependency** TypeScript library for consuming streaming HTTP responses from AI providers (OpenAI, Anthropic, Groq, etc.) that use the **Server-Sent Events (SSE)** protocol (`text/event-stream`).

The library wraps the native `fetch` API and transforms raw SSE byte streams into a Web-standard **`ReadableStream`** of parsed JSON objects, with support for field extraction, inactivity timeout, and dual output encoding (bytes or object).

**Supported environments:** Modern browsers, Node.js 18+, Deno, Bun, Cloudflare Workers — any runtime with `fetch`, `ReadableStream`, `TextDecoder`, and `TextEncoder`.

---

### Installation

```bash
npm install @felipe-lib/stream-http-event
# or
pnpm add @felipe-lib/stream-http-event
```

---

### API

#### `dataFetch(config): void`

Configures the instance before making requests. Must be called before `fetchIA()`.

```typescript
type dataFetchType = {
    url: string;                          // AI provider endpoint URL
    headers?: Record<string, string>;     // Custom HTTP headers (e.g., Authorization)
    timeOut?: number;                     // Inactivity timeout in ms
    extractor?: extractorType[];          // Default extractors
}
```

#### `fetchIA(options): Promise<ReadableStream | object>`

Executes the HTTP request. If the response `content-type` includes `text/event-stream`, returns a `ReadableStream`. Otherwise, parses the response as JSON.

```typescript
type FetchOptions = {
    signal?: AbortSignal;        // Cancellation via AbortController
    encodeBytes?: boolean;       // true = Uint8Array, false/undefined = object
    method?: string;             // HTTP method (default: "POST")
    body?: string;               // Request body (JSON string)
    extractor?: extractorType[]; // Call-specific extractors (overrides defaults)
}
```

---

### How the Buffer Works

The buffer solves the problem of network chunks arriving in arbitrary sizes, cutting through the middle of SSE lines.

#### Buffer core (`bufferControl`)

```typescript
private bufferControl() {
    let buffer = "";
    return {
        getBuffer: () => buffer,
        setBuffer: (data: string) => { buffer = data; },
        add: (data: string) => { buffer += data; },
    };
}
```

#### Serialization algorithm

In the `serialize()` method:

```typescript
const lines = buffer.getBuffer().split("\n");
buffer.setBuffer(lines.pop() ?? "");
```

- `.split("\n")` breaks the entire buffer by newlines
- `lines.pop()` removes and **returns the last element** — possibly an incomplete line that hasn't received its `\n` yet
- The remaining lines are **guaranteed complete** (terminated by `\n`)
- The incomplete fragment goes back into the buffer via `setBuffer()`, waiting for the next chunk

#### Step-by-step example

```
INITIAL STATE: buffer = ""

--- Chunk 1: "data: {\"content\":\"Hel" ---
buffer.add() → "data: {\"content\":\"Hel"
split("\n") → ["data: {\"content\":\"Hel"]
lines.pop() → "data: {\"content\":\"Hel" (back into buffer)
No complete lines to process.

--- Chunk 2: "lo\"}\n\ndata: {\"content\":\"Wo" ---
buffer before: "data: {\"content\":\"Hel"
buffer.add() → "data: {\"content\":\"Hello\"}\n\ndata: {\"content\":\"Wo"
split("\n") → ["data: {\"content\":\"Hello\"}", "", "data: {\"content\":\"Wo"]
lines.pop() → "data: {\"content\":\"Wo" (incomplete, back into buffer)
Complete lines:
  "data: {\"content\":\"Hello\"}" → JSON.parse → enqueued
  "" (empty line) → skipped

--- Chunk 3: "rld\"}\n\ndata: [DONE]\n\n" ---
buffer before: "data: {\"content\":\"Wo"
buffer.add() → "data: {\"content\":\"World\"}\n\ndata: [DONE]\n\n"
split("\n") → ["data: {\"content\":\"World\"}", "", "data: [DONE]", ""]
lines.pop() → "" (empty, harmless)
Complete lines:
  "data: {\"content\":\"World\"}" → enqueued
  "data: [DONE]" → detected → stream closed
```

---

### Extractor System

Extractors map raw AI response shapes into custom output objects.

**Type definition:**

```typescript
interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event: TEvent;
    }) => Record<string, unknown>;
}
```

**Example with OpenAI:**

```typescript
const extractors: extractorType[] = [
    {
        fn: ({ data }) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    },
    {
        fn: ({ data }) => {
            const role = data.choices?.[0]?.delta?.role;
            return role ? { role } : {};
        }
    }
];
```

**Behavior:**
- Each `fn()` receives the parsed JSON from the `data:` field and the parsed event from the `event:` field
- The result of each `fn()` is stored under the `"extracted"` key in state — later extractors **overwrite** this key's value (intentional, each chunk is independent)
- If `state.hasStateByKey("extracted")` is `true` after the loop, the value is enqueued **instead** of the raw JSON
- State is cleared between each processed line

**What arrives in the stream without extractors:**

Nothing is enqueued — only `stateLongDuration` accumulates raw data for future use.

**What arrives in the stream with extractors:**

```json
{"content":"Hello","role":"assistant"}
```

Instead of the full raw OpenAI JSON.

---

### Local and Long-Duration State

Two independent states are created in `streamIA()`:

| State | Scope | Purpose |
|--------|--------|-----------|
| `state` | Single SSE line | Accumulates `data`, `event`, and `extracted` for the current line, cleared after enqueue |
| `stateLongDuration` | Entire stream | Accumulates `data` (latest value) and `extractedLongDuration` (merge `{...old, ...new}`) across chunks — for future use |

**Extractor + state algorithm per line:**

```
1. parseAndExtracted():
   - Extracts the value after "data: " or "event: "
   - JSON.parse → stores in state
   - For each extractor: fn({ data, event }) → state.setState({ extracted: result })
   - If extractor.length > 0 and (data or event exist): extractor loop

2. serialize():
   - If state.hasStateByKey("extracted"):
     - Reads extracted from state
     - Reads accumulated from stateLongDuration ("extractedLongDuration")
     - stateLongDuration.setState({ extractedLongDuration: { ...old, ...new } })
     - Enqueues: encodeBytes ? encoder.encode(JSON.stringify(extracted)) : extracted
     - state.clearState()
```

---

### Timeout Mechanism

**Inactivity-based** timeout between chunks — does not limit total request duration. The timer resets on every received chunk.

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 10000  // 10 seconds of inactivity
});
```

**Behavior:**
1. Timer starts on first chunk
2. Each new chunk resets the timer
3. If expired: `controller.error(new Error(...))` + `bodyReader.cancel()`
4. If stream ends normally (`[DONE]` or body end): timer is cleared

**Implementation:** `timeout()` and `timeOutControl()` methods.

---

### Encoding Modes (`encodeBytes`)

| `encodeBytes` | Each chunk type | Use case |
|---|---|---|
| `false` or `undefined` | `object` (parsed object) | Direct consumption, logging, debugging |
| `true` | `Uint8Array` | Piping, file writing, binary consumption |

---

### `[DONE]` Detection

The SSE protocol signals end-of-stream with `data: [DONE]`. `serialize()` detects this line, calls `controller.close()`, and returns `true`, ending the read loop.

---

### Complete Data Flow

```
fetchIA()
 ├─ fetch(url, { method, headers, body, signal })
 ├─ !fetcher.ok → throw Error(status)
 ├─ !fetcher.body → throw Error
 ├─ content-type includes "text/event-stream"?
 │   ├─ YES → streamIA()
 │   │   ├─ body.getReader()
 │   │   ├─ bufferControl() → accumulates decoded bytes
 │   │   ├─ timeOutControl() → manages setTimeout
 │   │   ├─ stateLocal() × 2 → state + stateLongDuration
 │   │   └─ ReadableStream:
 │   │       └─ while(true):
 │   │           ├─ bodyReader.read()
 │   │           ├─ done? → close stream, break
 │   │           ├─ decoder.decode(value)
 │   │           ├─ buffer.add()
 │   │           ├─ timeout() → reset timer
 │   │           └─ serialize():
 │   │               ├─ split("\n") → pop incomplete line
 │   │               ├─ for each line:
 │   │               │   ├─ "data: [DONE]" → close, return true
 │   │               │   ├─ startsWith("data:") → parseAndExtracted(eventName="data")
 │   │               │   ├─ startsWith("event:") → parseAndExtracted(eventName="event")
 │   │               │   └─ hasStateByKey("extracted")?
 │   │               │       ├─ extract + accumulate in stateLongDuration
 │   │               │       ├─ encodeBytes? enqueue bytes : enqueue object
 │   │               │       └─ state.clearState()
 │   │               └─ return false
 │   └─ NO → fetcher.json()
```

---

### Use Cases

#### 1. Chat streaming with OpenAI

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-your-token"
    },
    timeOut: 30000,
    extractor: [
        {
            fn: ({ data }) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            }
        }
    ]
});

async function main() {
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
        process.stdout.write((value as { content: string }).content);
    }
    console.log("\n--- End ---");
}

main();
```

#### 2. Streaming with cancellation (AbortController)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 60000
});

const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Tell a long story" }],
        stream: true
    }),
    signal: controller.signal
});
```

#### 3. Streaming with Anthropic (Claude)

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
    extractor: [
        {
            fn: ({ data }) => {
                if (data.type === "content_block_delta") {
                    return { text: data.delta?.text };
                }
                return {};
            }
        }
    ]
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

#### 4. Groq

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: {
        "Authorization": "Bearer gsk_your-token",
        "Content-Type": "application/json"
    },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        }
    ]
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "What is the capital of Brazil?" }],
        stream: true
    })
}) as ReadableStream<{ content: string }>;
```

#### 5. Non-streaming consumption (JSON fallback)

```typescript
const stream = new StreamHttpEvent();
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

#### 6. Multiple extractors

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [
        {
            fn: ({ data }) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        },
        {
            fn: ({ data }) => ({
                finish_reason: data.choices?.[0]?.finish_reason ?? ""
            })
        }
    ]
});
// Each enqueued chunk: last extractor defines the format
```

#### 7. Piping stream to file (`encodeBytes: true`)

```typescript
const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Generate a large JSON" }],
        stream: true
    }),
    encodeBytes: true
}) as ReadableStream<Uint8Array>;

// Node.js
import { createWriteStream } from "node:fs";
const writeStream = createWriteStream("output.jsonl");
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    writeStream.write(value);
}
writeStream.end();
```

#### 8. HTTP server proxying the stream (Bun)

```typescript
const stream = new StreamHttpEvent();
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

#### 9. Batch processing with multiple providers

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
    openaiStream.fetchIA({
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Summarize: what is AI?" }],
            stream: true
        })
    }),
    groqStream.fetchIA({
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Summarize: what is AI?" }],
            stream: true
        })
    })
]);
```

---

### TypeScript Types

```typescript
// src/type.ts

interface bufferControlType {
    getBuffer: () => string;
    setBuffer: (data: string) => void;
    add: (data: string) => void;
}

interface timeOutControlType {
    getTime: () => ReturnType<typeof setTimeout> | undefined;
    setTime: ({ id }: { id: ReturnType<typeof setTimeout> }) => void;
    clearTime: () => void;
}

interface stateLocalType {
    getState: () => unknown | Record<string, unknown>;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

interface extractorType<TData extends object, TEvent = unknown> {
    fn: ({
        data,
        event,
    }: {
        data: TData;
        event: TEvent;
    }) => Record<string, unknown>;
}

interface dataFetchType<TData extends object, TEvent = unknown> {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType<TData, TEvent>[];
}

interface FetchOptions<TData extends object, TEvent = unknown> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType<TData, TEvent>[];
}
```

---

### Project Structure

```
.
├── src/
│   ├── streamHttpEvent.ts    # Main class
│   └── type.ts               # Type definitions
├── dist/                     # Compiled output (ES2022 ESM)
├── package.json
├── tsconfig.json             # target: ES2022, module: ES2022, strict: true
└── README.md
```

### License

ISC
