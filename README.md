# @felipe-lib/stream-http-event

---

## 📘 Português

### Visão Geral

`@felipe-lib/stream-http-event` é uma biblioteca TypeScript leve (zero dependências externas de runtime) para consumir respostas HTTP em streaming de provedores de IA (OpenAI, Anthropic, Groq, etc.) que utilizam o protocolo **Server-Sent Events (SSE)** com `text/event-stream`.

A biblioteca encapsula a API nativa `fetch` e transforma o fluxo bruto de bytes SSE em uma **`ReadableStream`** de objetos JSON parseados, com suporte a extração de campos, timeout por inatividade e dupla codificação (bytes ou string).

**Ambientes suportados:** Navegadores modernos, Node.js 18+, Deno, Bun, Cloudflare Workers — qualquer runtime que suporte `fetch`, `ReadableStream`, `TextDecoder` e `TextEncoder`.

---

### Instalação

```bash
npm install @felipe-lib/stream-http-event
# ou
pnpm add @felipe-lib/stream-http-event
```

---

### Funcionalidades

- **Consumo SSE → ReadableStream** — Converte fluxos `text/event-stream` em streams de objetos JSON
- **Buffer inteligente** — Lida com chunks de rede que chegam cortados no meio de linhas SSE
- **Timeout por inatividade** — Encerra o stream automaticamente se o provedor parar de enviar dados
- **Sistema de Extractors** — Transforma o formato bruto da resposta da IA em objetos customizados
- **Dupla codificação** — Saída como `string` (JSON puro) ou `Uint8Array` (bytes codificados)
- **Detecção de `[DONE]`** — Reconhece o sinal de fim de stream do protocolo SSE
- **Fallback para JSON** — Se o endpoint não retornar `text/event-stream`, faz parse como JSON comum
- **Controle de AbortSignal** — Suporte a cancelamento via `AbortController`

---

### API

#### `dataFetch(config: dataFetchType): void`

Configura a instância antes de realizar as chamadas. Deve ser chamada antes de `fetchIA()`.

```typescript
type dataFetchType = {
    url: string;                        // URL do endpoint da IA
    headers?: Record<string, string>;   // Headers HTTP customizados (ex: Authorization)
    timeOut?: number;                   // Timeout de inatividade em ms
    extractor?: extractorType[];        // Extractors padrão para todas as chamadas
}
```

#### `fetchIA<O extends object>(options: FetchOptions): Promise<ReadableStream<O> | O>`

Executa a requisição HTTP e retorna o resultado. Se o `content-type` da resposta for `text/event-stream`, retorna uma `ReadableStream<O>`. Caso contrário, faz parse como JSON e retorna o objeto `O`.

```typescript
type FetchOptions<O extends object = object> = {
    signal?: AbortSignal;       // Sinal para cancelamento
    encodeBytes?: boolean;      // true = Uint8Array, false/undefined = string
    method?: string;            // Método HTTP (padrão: "POST")
    body?: string;              // Corpo da requisição (string JSON)
    extractor?: extractorType[];// Extractors específicos desta chamada (sobrescreve os padrão)
}
```

---

### Como o Buffer Funciona

O buffer resolve um problema fundamental do streaming sobre rede: **os chunks de bytes chegam em tamanhos arbitrários que podem cortar linhas SSE no meio**.

#### O problema

Dados SSE de um provedor de IA chegam assim:

```
data: {"choices":[{"delta":{"content":"Olá"}}]}

data: {"choices":[{"delta":{"content":" mundo"}}]}

data: [DONE]
```

Mas a rede entrega os chunks de forma imprevisível:

```
Chunk 1: "data: {\"choices\":[{\"delta\":{\"content\":\"Ol"
Chunk 2: "á\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" mun"
Chunk 3: "do\"}}]}\n\ndata: [DONE]\n\n"
```

Sem buffer, tentar fazer `.split("\n")` no Chunk 1 resultaria em uma linha incompleta que não é JSON válido.

#### A solução

O coração do buffer está no método `bufferControl()` (`src/streamHttpEvent.ts:42-54`):

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

Três operações simples:
1. **`add(data)`** — Concatena cada novo chunk decodificado ao buffer
2. **`getBuffer()`** — Retorna o conteúdo atual do buffer
3. **`setBuffer(data)`** — Substitui o buffer inteiro (usado para reaproveitar linhas incompletas)

#### O algoritmo de serialização

No método `serialize()` (`src/streamHttpEvent.ts:91-153`):

```typescript
const lines = buffer.getBuffer().split("\n");   // Divide o buffer por quebras de linha
buffer.setBuffer(lines.pop() ?? "");             // A última linha (possivelmente incompleta) volta ao buffer
```

Este é o **insight chave**:
- `.split("\n")` quebra todo o buffer em linhas
- `lines.pop()` remove e **guarda o último elemento** — que pode ser uma linha incompleta que ainda não recebeu seu `\n`
- As linhas restantes são **garantidamente completas** (terminadas por `\n`)
- O fragmento incompleto é armazenado de volta no buffer via `setBuffer()`, aguardando o próximo chunk

#### Exemplo passo a passo

```
ESTADO INICIAL: buffer = ""

--- Chunk 1 chega: "data: {\"content\":\"Hel" ---
buffer.add() → buffer = "data: {\"content\":\"Hel"
split("\n") → ["data: {\"content\":\"Hel"]
lines.pop() → "data: {\"content\":\"Hel" (volta ao buffer)
Nenhuma linha completa para processar.

--- Chunk 2 chega: "lo\"}\n\ndata: {\"content\":\"Wo" ---
buffer antes: "data: {\"content\":\"Hel"
buffer.add() → buffer = "data: {\"content\":\"Hello\"}\n\ndata: {\"content\":\"Wo"
split("\n") → ["data: {\"content\":\"Hello\"}", "", "data: {\"content\":\"Wo"]
lines.pop() → "data: {\"content\":\"Wo" (incompleta, volta ao buffer)
Linhas completas:
  - "data: {\"content\":\"Hello\"}" → JSON.parse → enfileirado ✓
  - "" (linha vazia) → ignorada

--- Chunk 3 chega: "rld\"}\n\ndata: [DONE]\n\n" ---
buffer antes: "data: {\"content\":\"Wo"
buffer.add() → buffer = "data: {\"content\":\"World\"}\n\ndata: [DONE]\n\n"
split("\n") → ["data: {\"content\":\"World\"}", "", "data: [DONE]", "", ""]
lines.pop() → "" (vazia, sem efeito colateral)
Linhas completas:
  - "data: {\"content\":\"World\"}" → enfileirado ✓
  - "" → ignorada
  - "data: [DONE]" → detectado → stream fechado ✓
```

---

### Sistema de Extractors

Os extractors permitem mapear a resposta bruta da IA para um formato customizado, extraindo apenas os campos desejados.

**Definição do tipo:**

```typescript
interface extractorType {
    key: string;                                         // Nome da chave no estado extraído
    fn: (data: Record<string, any>) => Record<string, any>; // Função que recebe o JSON parseado e retorna um objeto
}
```

**Exemplo com OpenAI:**

```typescript
const extractors: extractorType[] = [
    {
        key: "content",
        fn: (data) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    },
    {
        key: "role",
        fn: (data) => {
            const role = data.choices?.[0]?.delta?.role;
            return role ? { role } : {};
        }
    }
];

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: extractors
});
```

**Comportamento:**
- Cada extractor é executado na ordem para cada linha `data:` parseada
- O resultado de cada `fn()` é mesclado em um mapa de estado compartilhado
- Se ao final da execução de todos os extractores **pelo menos uma chave** (definida no extractor) estiver presente no estado, o objeto de estado acumulado é enfileirado **em vez** do JSON bruto
- O estado é limpo entre cada linha `data:` processada

**O que chega no stream sem extractor:**
```json
{"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Olá","role":"assistant"}}]}
```

**O que chega no stream com extractor:**
```json
{"content":"Olá","role":"assistant"}
```

---

### Mecanismo de Timeout

O timeout é **baseado em inatividade** entre chunks — não limita o tempo total da requisição. A cada chunk de rede recebido e processado, o timer é resetado.

```typescript
// Timeout de 10 segundos de inatividade
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 10000
});
```

**Comportamento:**
1. O timer inicia ao receber o primeiro chunk
2. Cada novo chunk reseta o timer
3. Se o tempo expirar sem dados novos:
   - O controller da `ReadableStream` emite um erro: `"Ops, Sua provedor de IA demorou mais de {timeOut}ms"`
   - O `bodyReader` é cancelado (abortando o fetch subjacente)
4. Se o stream terminar normalmente (`[DONE]` ou fim do body), o timer é limpo

**Implementação:** `src/streamHttpEvent.ts:72-89` e `src/streamHttpEvent.ts:56-70`

---

### Modos de Encoding (`encodeBytes`)

O parâmetro `encodeBytes` controla o formato de saída da `ReadableStream`:

| `encodeBytes` | Tipo de cada chunk | Uso |
|---|---|---|
| `false` ou `undefined` | `string` (JSON puro) | Consumo direto em código, fácil de logar e debugar |
| `true` | `Uint8Array` | Piping para outra stream, gravação em arquivo, consumo binário |

**Exemplo com `encodeBytes: false`:**
```typescript
const stream = await stream.fetchIA({ encodeBytes: false });
// stream.getReader().read() → { value: '{"content":"Olá"}', done: false }
```

**Exemplo com `encodeBytes: true`:**
```typescript
const stream = await stream.fetchIA({ encodeBytes: true });
// stream.getReader().read() → { value: Uint8Array([...]), done: false }
// Cada chunk é a string JSON + "\n" codificada em UTF-8
```

---

### Casos de Uso

#### 1. Streaming de chat com OpenAI (ChatGPT)

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-seu-token-aqui"
    },
    timeOut: 30000,
    extractor: [
        {
            key: "content",
            fn: (data) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            }
        }
    ]
});

async function main() {
    const readableStream = await stream.fetchIA<string>({
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Explique o que é Server-Sent Events" }],
            stream: true
        }),
        extractor: [
            {
                key: "content",
                fn: (data) => {
                    const content = data.choices?.[0]?.delta?.content;
                    return content ? { content } : {};
                }
            }
        ]
    }) as ReadableStream<{ content: string }>;

    const reader = readableStream.getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        process.stdout.write(JSON.parse(value as string).content);
    }
    console.log("\n--- Fim do stream ---");
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

// Cancela após 5 segundos
setTimeout(() => {
    controller.abort();
    console.log("Requisição cancelada pelo usuário");
}, 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Conte uma história longa" }],
        stream: true
    }),
    signal: controller.signal
});
```

#### 3. Consumo sem streaming (fallback JSON)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

// Sem "stream: true", o endpoint retorna JSON normal
const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá" }],
        stream: false
    })
});

// result é o objeto JSON completo (não é um ReadableStream)
console.log(result.choices[0].message.content);
```

#### 4. Streaming com Anthropic (Claude)

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
            key: "text",
            fn: (data) => {
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
        messages: [{ role: "user", content: "Olá" }],
        stream: true
    })
}) as ReadableStream<{ text: string }>;

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = JSON.parse(value as string);
    if (parsed.text) process.stdout.write(parsed.text);
}
```

#### 5. Groq (LPU acelerado)

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
            key: "content",
            fn: (data) => ({
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

#### 6. Múltiplos extractors para métricas

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [
        {
            key: "content",
            fn: (data) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        },
        {
            key: "finish_reason",
            fn: (data) => ({
                finish_reason: data.choices?.[0]?.finish_reason ?? ""
            })
        },
        {
            key: "usage",
            fn: (data) => {
                if (data.usage) {
                    return { usage: data.usage };
                }
                return {};
            }
        }
    ]
});

// Cada chunk enfileirado terá { content, finish_reason?, usage? }
```

#### 7. Piping do stream para arquivo (encodeBytes: true)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Gere um JSON grande" }],
        stream: true
    }),
    encodeBytes: true   // Saída como Uint8Array
}) as ReadableStream<Uint8Array>;

// Em Node.js, gravar em arquivo:
import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";

const writeStream = createWriteStream("output.jsonl");
const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    writeStream.write(value);
}
writeStream.end();
```

#### 8. Servidor HTTP que faz proxy do stream (Bun/Deno/Node)

```typescript
// Usando Bun
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

#### 9. Processamento em lote com múltiplos provedores

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

// Dispara ambas em paralelo
const [openaiResult, groqResult] = await Promise.all([
    openaiStream.fetchIA({
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Resuma em uma frase: o que é IA?" }],
            stream: true
        })
    }),
    groqStream.fetchIA({
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Resuma em uma frase: o que é IA?" }],
            stream: true
        })
    })
]);
```

---

### Tipos TypeScript

```typescript
// src/type.ts

interface extractorType {
    key: string;
    fn: (data: Record<string, any>) => Record<string, any>;
}

interface dataFetchType {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType[];
}

interface FetchOptions<O extends object = object> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType[];
}

// Tipos internos expostos para referência:
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
    getState: () => unknown | undefined;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

interface serializeType {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor?: extractorType[];
    encodeBytes: undefined | boolean;
    state: stateLocalType;
}

interface timeoutType {
    controller: ReadableStreamDefaultController<any>;
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

interface streamIaType {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
    extractor?: extractorType[];
}
```

---

## 📘 English

### Overview

`@felipe-lib/stream-http-event` is a lightweight, **zero runtime dependency** TypeScript library for consuming streaming HTTP responses from AI providers (OpenAI, Anthropic, Groq, etc.) that use the **Server-Sent Events (SSE)** protocol (`text/event-stream`).

The library wraps the native `fetch` API and transforms raw SSE byte streams into a Web-standard **`ReadableStream`** of parsed JSON objects, with support for field extraction, inactivity timeout, and dual output encoding (bytes or string).

**Supported environments:** Modern browsers, Node.js 18+, Deno, Bun, Cloudflare Workers — any runtime with `fetch`, `ReadableStream`, `TextDecoder`, and `TextEncoder`.

---

### Installation

```bash
npm install @felipe-lib/stream-http-event
# or
pnpm add @felipe-lib/stream-http-event
```

---

### Features

- **SSE → ReadableStream** — Converts `text/event-stream` responses into streams of parsed JSON objects
- **Smart buffering** — Handles network chunks that arrive mid-line in SSE data
- **Inactivity timeout** — Automatically errors the stream if the provider stops sending data
- **Extractor system** — Maps raw AI response shapes into custom output objects
- **Dual encoding** — Output as `string` (raw JSON) or `Uint8Array` (encoded bytes)
- **`[DONE]` detection** — Recognizes the standard SSE stream termination signal
- **JSON fallback** — If the endpoint doesn't return `text/event-stream`, parses it as plain JSON
- **AbortSignal support** — Cancellation via `AbortController`

---

### API

#### `dataFetch(config: dataFetchType): void`

Configures the instance before making requests. Must be called before `fetchIA()`.

```typescript
type dataFetchType = {
    url: string;                        // AI provider endpoint URL
    headers?: Record<string, string>;   // Custom HTTP headers (e.g., Authorization)
    timeOut?: number;                   // Inactivity timeout in ms
    extractor?: extractorType[];        // Default extractors for all calls
}
```

#### `fetchIA<O extends object>(options: FetchOptions): Promise<ReadableStream<O> | O>`

Executes the HTTP request and returns the result. If the response `content-type` is `text/event-stream`, returns a `ReadableStream<O>`. Otherwise, parses the response as JSON and returns object `O`.

```typescript
type FetchOptions<O extends object = object> = {
    signal?: AbortSignal;       // Cancellation signal
    encodeBytes?: boolean;      // true = Uint8Array, false/undefined = string
    method?: string;            // HTTP method (default: "POST")
    body?: string;              // Request body (JSON string)
    extractor?: extractorType[];// Call-specific extractors (overrides defaults)
}
```

---

### How the Buffer Works

The buffer solves a fundamental problem of network streaming: **byte chunks arrive in arbitrary sizes that can cut through the middle of SSE lines**.

#### The Problem

SSE data from an AI provider arrives like this:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

But the network delivers chunks unpredictably:

```
Chunk 1: "data: {\"choices\":[{\"delta\":{\"content\":\"Hel"
Chunk 2: "lo\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" wor"
Chunk 3: "ld\"}}]}\n\ndata: [DONE]\n\n"
```

Without buffering, calling `.split("\n")` on Chunk 1 would produce an incomplete line that isn't valid JSON.

#### The Solution

The buffer's core is the `bufferControl()` method (`src/streamHttpEvent.ts:42-54`):

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

Three simple operations:
1. **`add(data)`** — Appends each newly decoded chunk to the buffer
2. **`getBuffer()`** — Returns the current buffer contents
3. **`setBuffer(data)`** — Replaces the entire buffer (used to retain incomplete lines)

#### The Serialization Algorithm

In the `serialize()` method (`src/streamHttpEvent.ts:91-153`):

```typescript
const lines = buffer.getBuffer().split("\n");   // Split buffer by newlines
buffer.setBuffer(lines.pop() ?? "");             // The last (possibly incomplete) line goes back into the buffer
```

This is the **key insight**:
- `.split("\n")` breaks the entire buffer into lines
- `lines.pop()` removes and **keeps the last element** — this could be an incomplete line that hasn't received its `\n` yet
- The remaining lines are **guaranteed to be complete** (terminated by `\n`)
- The incomplete fragment is stored back in the buffer via `setBuffer()`, waiting for the next chunk

#### Step-by-Step Example

```
INITIAL STATE: buffer = ""

--- Chunk 1 arrives: "data: {\"content\":\"Hel" ---
buffer.add() → buffer = "data: {\"content\":\"Hel"
split("\n") → ["data: {\"content\":\"Hel"]
lines.pop() → "data: {\"content\":\"Hel" (goes back into buffer)
No complete lines to process.

--- Chunk 2 arrives: "lo\"}\n\ndata: {\"content\":\"Wo" ---
buffer before: "data: {\"content\":\"Hel"
buffer.add() → buffer = "data: {\"content\":\"Hello\"}\n\ndata: {\"content\":\"Wo"
split("\n") → ["data: {\"content\":\"Hello\"}", "", "data: {\"content\":\"Wo"]
lines.pop() → "data: {\"content\":\"Wo" (incomplete, goes back into buffer)
Complete lines:
  - "data: {\"content\":\"Hello\"}" → JSON.parse → enqueued ✓
  - "" (empty line) → skipped

--- Chunk 3 arrives: "rld\"}\n\ndata: [DONE]\n\n" ---
buffer before: "data: {\"content\":\"Wo"
buffer.add() → buffer = "data: {\"content\":\"World\"}\n\ndata: [DONE]\n\n"
split("\n") → ["data: {\"content\":\"World\"}", "", "data: [DONE]", "", ""]
lines.pop() → "" (empty, harmless)
Complete lines:
  - "data: {\"content\":\"World\"}" → enqueued ✓
  - "" → skipped
  - "data: [DONE]" → detected → stream closed ✓
```

---

### Extractor System

Extractors map raw AI response shapes into custom formats, extracting only the desired fields.

**Type definition:**

```typescript
interface extractorType {
    key: string;                                         // Key name in the extracted state
    fn: (data: Record<string, any>) => Record<string, any>; // Function receiving parsed JSON, returning an object
}
```

**Example with OpenAI:**

```typescript
const extractors: extractorType[] = [
    {
        key: "content",
        fn: (data) => {
            const content = data.choices?.[0]?.delta?.content;
            return content ? { content } : {};
        }
    },
    {
        key: "role",
        fn: (data) => {
            const role = data.choices?.[0]?.delta?.role;
            return role ? { role } : {};
        }
    }
];
```

**Behavior:**
- Each extractor runs in order for every parsed `data:` line
- Each `fn()` result is merged into a shared state map
- If, after all extractors execute, **at least one key** (from the extractor definitions) exists in the state, the accumulated state object is enqueued **instead** of the raw JSON
- State is cleared between each processed `data:` line

**What arrives in the stream without extractor:**
```json
{"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello","role":"assistant"}}]}
```

**What arrives in the stream with extractor:**
```json
{"content":"Hello","role":"assistant"}
```

---

### Timeout Mechanism

The timeout is **inactivity-based** between chunks — it does not limit total request duration. The timer resets every time a network chunk is received and processed.

```typescript
// 10-second inactivity timeout
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    timeOut: 10000
});
```

**Behavior:**
1. Timer starts upon receiving the first chunk
2. Each new chunk resets the timer
3. If time expires without new data:
   - The `ReadableStream` controller emits an error: `"Ops, Sua provedor de IA demorou mais de {timeOut}ms"` (Portuguese: "Oops, your AI provider took more than {timeOut}ms")
   - The `bodyReader` is cancelled (aborting the underlying fetch)
4. If the stream ends normally (`[DONE]` or body end), the timer is cleared

**Implementation:** `src/streamHttpEvent.ts:72-89` and `src/streamHttpEvent.ts:56-70`

---

### Encoding Modes (`encodeBytes`)

The `encodeBytes` parameter controls the `ReadableStream` output format:

| `encodeBytes` | Each chunk type | Use case |
|---|---|---|
| `false` or `undefined` | `string` (raw JSON) | Direct consumption in code, easy to log and debug |
| `true` | `Uint8Array` | Piping to another stream, writing to files, binary consumption |

**Example with `encodeBytes: false`:**
```typescript
const stream = await stream.fetchIA({ encodeBytes: false });
// stream.getReader().read() → { value: '{"content":"Hello"}', done: false }
```

**Example with `encodeBytes: true`:**
```typescript
const stream = await stream.fetchIA({ encodeBytes: true });
// stream.getReader().read() → { value: Uint8Array([...]), done: false }
// Each chunk is the JSON string + "\n" encoded as UTF-8
```

---

### Use Cases

#### 1. Chat streaming with OpenAI (ChatGPT)

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-your-token-here"
    },
    timeOut: 30000,
    extractor: [
        {
            key: "content",
            fn: (data) => {
                const content = data.choices?.[0]?.delta?.content;
                return content ? { content } : {};
            }
        }
    ]
});

async function main() {
    const readableStream = await stream.fetchIA<string>({
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Explain Server-Sent Events" }],
            stream: true
        }),
        extractor: [
            {
                key: "content",
                fn: (data) => {
                    const content = data.choices?.[0]?.delta?.content;
                    return content ? { content } : {};
                }
            }
        ]
    }) as ReadableStream<{ content: string }>;

    const reader = readableStream.getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        process.stdout.write(JSON.parse(value as string).content);
    }
    console.log("\n--- End of stream ---");
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

// Cancel after 5 seconds
setTimeout(() => {
    controller.abort();
    console.log("Request cancelled by user");
}, 5000);

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Tell a long story" }],
        stream: true
    }),
    signal: controller.signal
});
```

#### 3. Non-streaming consumption (JSON fallback)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

// Without "stream: true", the endpoint returns regular JSON
const result = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
    })
});

// result is the full JSON object (not a ReadableStream)
console.log(result.choices[0].message.content);
```

#### 4. Streaming with Anthropic (Claude)

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
            key: "text",
            fn: (data) => {
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

const reader = readableStream.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = JSON.parse(value as string);
    if (parsed.text) process.stdout.write(parsed.text);
}
```

#### 5. Groq (LPU accelerated)

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
            key: "content",
            fn: (data) => ({
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

#### 6. Multiple extractors for metrics

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." },
    extractor: [
        {
            key: "content",
            fn: (data) => ({
                content: data.choices?.[0]?.delta?.content ?? ""
            })
        },
        {
            key: "finish_reason",
            fn: (data) => ({
                finish_reason: data.choices?.[0]?.finish_reason ?? ""
            })
        },
        {
            key: "usage",
            fn: (data) => {
                if (data.usage) {
                    return { usage: data.usage };
                }
                return {};
            }
        }
    ]
});

// Each enqueued chunk will have { content, finish_reason?, usage? }
```

#### 7. Piping stream to file (encodeBytes: true)

```typescript
const stream = new StreamHttpEvent();
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Authorization": "Bearer sk-..." }
});

const readableStream = await stream.fetchIA({
    body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Generate a large JSON" }],
        stream: true
    }),
    encodeBytes: true   // Output as Uint8Array
}) as ReadableStream<Uint8Array>;

// Node.js: write to file
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

#### 8. HTTP server proxying the stream (Bun/Deno/Node)

```typescript
// Using Bun
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

// Fire both in parallel
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

interface extractorType {
    key: string;
    fn: (data: Record<string, any>) => Record<string, any>;
}

interface dataFetchType {
    url: string;
    headers?: Record<string, string>;
    timeOut?: number;
    extractor?: extractorType[];
}

interface FetchOptions<O extends object = object> {
    signal?: AbortSignal;
    encodeBytes?: boolean;
    method?: string;
    body?: string;
    extractor?: extractorType[];
}

// Internal types exposed for reference:
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
    getState: () => unknown | undefined;
    getStateOne: (key: string) => unknown | undefined;
    setState: (newState: Record<string, unknown>) => void;
    clearState: () => void;
    clearStateByKey: (key: string) => void;
    hasStateByKey: (key: string) => boolean;
}

interface serializeType {
    buffer: bufferControlType;
    controller: ReadableStreamDefaultController<any>;
    encoder: TextEncoder;
    extractor?: extractorType[];
    encodeBytes: undefined | boolean;
    state: stateLocalType;
}

interface timeoutType {
    controller: ReadableStreamDefaultController<any>;
    timeOutId: timeOutControlType;
    bodyReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;
}

interface streamIaType {
    body: ReadableStream<Uint8Array>;
    encodeBytes: boolean | undefined;
    extractor?: extractorType[];
}
```

---

### Estrutura do Projeto / Project Structure

```
.
├── src/
│   ├── streamHttpEvent.ts    # Classe principal (257 linhas)
│   └── type.ts               # Definições de tipos (61 linhas)
├── dist/                     # Saída compilada (ES2022 ESM)
├── package.json              # v1.3.6, zero dependências de runtime
├── tsconfig.json             # target: ES2022, module: ES2022, strict: true
└── README.md
```

### Licença / License

ISC
