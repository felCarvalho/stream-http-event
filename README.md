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
│  Network     │     │  getBuffer()    │     │ serialize()│     │ ReadableStream│
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
│  Chunks de   │     │  getBuffer()    │     │ serialize()│     │ ReadableStream│
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

## License

ISC
