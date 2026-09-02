# @felipe-lib/stream-http-event

[![npm version](https://img.shields.io/badge/npm-v2.3.0-blue)](https://www.npmjs.com/package/@felipe-lib/stream-http-event)
[![license](https://img.shields.io/badge/license-ISC-green)](./LICENSE)

**Zero dependências em runtime.** Consuma respostas HTTP em streaming de provedores de IA (OpenAI, Anthropic, Groq, DeepSeek, etc.) via o protocolo [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

Funciona em qualquer runtime com `fetch`, `AsyncGenerator`, `TextDecoder` e `TextEncoder` — navegadores, Node.js 18+, Deno, Bun, Cloudflare Workers.

---

# Português

---

## Índice

- [Instalação](#instalação)
- [Início Rápido](#início-rápido)
- [O que mudou?](#o-que-mudou)
- [Referência da API](#referência-da-api)
    - [`dataFetch()`](#datafetch)
    - [`ExtractorsType`](#extractortype)
    - [`fetchIA()`](#fetchia)
    - [`start()` e `abort()`](#start-e-abort)
- [Exemplos](#exemplos)
    - [Streaming OpenAI](#streaming-openai)
    - [DeepSeek com builders](#deepseek-com-builders)
    - [Anthropic](#anthropic)
    - [Cancelamento](#cancelamento)
    - [Salvando resposta completa (onDone)](#salvando-resposta-completa-ondon)
    - [Pipe para arquivo](#pipe-para-arquivo)
    - [Fallback não-streaming](#fallback-não-streaming)
    - [Múltiplos provedores](#múltiplos-provedores)
- [Como funciona internamente](#como-funciona-internamente)
- [Builders por Provedor](#builders-por-provedor)
    - [DeepSeek](#deepseek)
    - [Anthropic](#anthropic-1)
- [Tipos TypeScript públicos](#tipos-typescript-públicos)
- [Projeto Estudantil](#projeto-estudantil)

---

## Instalação

```bash
npm install @felipe-lib/stream-http-event
# ou
pnpm add @felipe-lib/stream-http-event
```

---

## Início Rápido

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-seu-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá!" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

A saída de cada chunk será algo como:

```
data: {"content":"Olá"}

```

---

## O que mudou?

Esta seção documenta as principais alterações em relação à versão anterior da API.

### Extractors

| Antes                                                   | Depois                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `extractor: [{ fn: ({ data }) => ({ content: ... }) }]` | `extractors: { defaultExtract: [{ key: "content", forExtract: "data.choices[0].delta.content" }] }` |

A API antiga usava funções JavaScript para extrair dados. A nova usa **paths** (strings que navegam pelo objeto JSON), tornando a configuração declarativa e serializável.

### Busca de chaves no stream

| Antes                                                                                               | Depois                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcoded `state.getStateOne("extracted")` — só funcionava se a key do extrator fosse `"extracted"` | **Loop dinâmico** — percorre **todas** as keys configuradas em `defaultExtract` e `conditionalxtractor`, montando a saída com cada uma |

### Formato de saída

| Antes                                                     | Depois                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sempre `data: {...}\nevent: ...\n\n` (formato SSE padrão) | Sempre `data: { "chave": "valor" }\n\n` (JSON do objeto extraído inteiro) |

### Código removido

- `onData` e `onEvent` — declarados mas nunca chamados
- `try { ... } catch (e) { throw e }` — blocos redundantes

### Bugs corrigidos

- `if (value)` agora é `if (value !== undefined)` — valores `0`, `""`, `false` não são mais ignorados
- `types.anthropic.ts`: campo `ccontent` corrigido para `content` (typo)
- `types.anthropic.ts`: duplicata removida de union type

### v2.2.1

**`accumulate`** — nova flag de acumulação de valores extraídos. Disponível em três níveis:

- **Global** (`dataFetchType.accumulate`): acumula todos os chunks em uma string contínua no output final
- **Extract padrão** (`extract.accumulate`): quando ativado, os valores de **todas as chaves** do `defaultExtract` são concatenados em uma única string compartilhada entre elas
- **Extract condicional** (`condicionalExtract.accumulate`): quando ativado, os valores de **todas as chaves** do `conditionalxtractor` são concatenados em uma única string compartilhada entre elas

**`start()` e `abort()`** — novos métodos públicos para gerenciar o ciclo de vida da requisição. Use `start()` para obter o `AbortController` interno e `abort()` para cancelar a requisição.

**`extractors` opcional** — o campo `extractors` em `dataFetchType` agora é opcional, permitindo usar `fetchIA()` para chamadas não-streaming sem configurar extratores.

### v2.3.0

**`AnthropicInputSchemaBuilder`** e **`AnthropicToolBuilder`** — novos builders para criação de ferramentas (tools) no provedor Anthropic, análogos aos existentes no DeepSeek.

**`tools()`** e **`toolChoice()`** — novos métodos no `AnthropicBodyBuilder` para configurar ferramentas e escolha de tool no corpo da requisição.

**`AnthropicToolUnion`** — novo type alias exportado que une todos os tipos de ferramenta Anthropic (custom + server tools).

**`tools`** — adicionado a `MessageCreateParamsBase` como `AnthropicToolUnion[]`.

### v2.2.3

Correção do typo `acumullate` para `accumulate` em toda a codebase (propriedade privada, parâmetro de `dataFetch()`, interfaces `extract` e `condicionalExtract`, e tipo `dataFetchType`).

---

## Referência da API

### `dataFetch()`

Configura a instância. Deve ser chamado antes de `fetchIA()`.

```typescript
stream.dataFetch<H, B>(config: dataFetchType<H, B>): void
```

| Parâmetro       | Tipo                                                      | Obrigatório | Descrição                                                                                                  |
| --------------- | --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `url`           | `string`                                                  | Sim         | Endpoint do provedor de IA                                                                                 |
| `headers`       | `Record<string, string>`                                  | Não         | Headers HTTP. Pode ser tipado via builder de provedor                                                      |
| `body`          | `Record<string, unknown>`                                 | Não         | Corpo da requisição (serializado como JSON)                                                                |
| `timeOut`       | `number`                                                  | Não         | Timeout de inatividade em milissegundos. Reseta a cada chunk                                               |
| `onDone`        | `(finalData: { chunks: Record<string, unknown>[] }) => void` | Não      | Callback disparado quando o stream termina. Recebe `{ chunks }` — array de objetos extraídos chunk a chunk |
| `extractors`    | `ExtractorsType`                                          | Não         | Configuração dos extratores de dados                                                                       |
| `beforeRequest` | `BeforeRequestFn`                                         | Não         | Função assíncrona executada antes do fetch. Recebe `{ url, headers, body }` e pode modificar cada campo. Se retornar `void`, os valores originais são mantidos |
| `accumulate`    | `boolean`                                                 | Não         | Se `true`, acumula os valores extraídos de todos os chunks em uma string contínua no output final           |

---

### `ExtractorsType`

```typescript
interface ExtractorsType {
    defaultExtract: extract[];
    conditionalxtractor?: condicionalExtract[];
}

interface extract {
    key: string;
    forExtract: string;
    accumulate?: boolean;
}

interface condicionalExtract {
    key: string;
    path: string;
    accumulate?: boolean;
    condition: string;
}
```

**`defaultExtract`** — sempre aplicado em cada mensagem SSE:

- `key`: nome da chave que será usada na saída e no state interno
- `forExtract`: caminho JSON para navegar até o valor desejado (ex: `"data.choices[0].delta.content"`)
- `accumulate`: se `true`, o valor extraído é concatenado a um acumulador **compartilhado entre todas as chaves** do `defaultExtract`
- Suporta navegação por pontos e colchetes: `"data.choices[0].delta.content"`

**`conditionalxtractor`** — aplicado apenas se a condição for satisfeita:

- `key`: nome da chave de saída
- `path`: caminho JSON para navegar até o valor
- `accumulate`: se `true`, o valor extraído é concatenado a um acumulador **compartilhado entre todas as chaves** do `conditionalxtractor`
- `condition`: valor esperado. Se o valor no `path` for igual a `condition`, o valor é extraído

**Mesclagem de keys:** as keys de `defaultExtract` e `conditionalxtractor` são combinadas. Se ambos os arrays tiverem entries, **todas** as keys são usadas na saída.

---

### `fetchIA()`

Executa a requisição HTTP e retorna um `AsyncGenerator` ou um objeto JSON parseado.

```typescript
stream.fetchIA(options: FetchOptions): Promise<any>
```

| Parâmetro     | Tipo      | Padrão   | Descrição                                                             |
| ------------- | --------- | -------- | --------------------------------------------------------------------- |
| `method`      | `string`  | `"POST"` | Método HTTP                                                           |
| `encodeBytes` | `boolean` | `false`  | Se `true`, chunks yieldados são `Uint8Array`. Se `false`, são strings |

**Retorna:**

- `AsyncGenerator<string | Uint8Array, void, unknown>` — se `Content-Type` for `text/event-stream`
- `Record<string, unknown>` — o JSON parseado para respostas não-streaming

---

## Exemplos

### Streaming OpenAI

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        Authorization: "Bearer sk-seu-token",
        "Content-Type": "application/json",
    },
    timeOut: 30000,
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explique SSE" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### DeepSeek com builders

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
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### Anthropic

O Anthropic usa um formato SSE diferente. Exemplo com `defaultExtract` + `conditionalxtractor`:

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "x-api-key": "sk-ant-seu-token",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    },
    timeOut: 30000,
    body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Olá" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [{ key: "text", forExtract: "data.delta.text" }],
        conditionalxtractor: [
            {
                key: "eventType",
                path: "data.type",
                condition: "content_block_delta",
            },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### Cancelamento

Use `start()` para obter o `AbortController` e `abort()` para cancelar:

```typescript
const controller = stream.start();
setTimeout(() => stream.abort(), 5000);

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    console.log(chunk);
}
```

Via `break` no loop:

```typescript
const generator = await stream.fetchIA();

let count = 0;
for await (const chunk of generator) {
    console.log(chunk);
    count++;
    if (count >= 10) break;
}
```

### `start()` e `abort()`

Gerenciam o ciclo de vida da requisição:

```typescript
stream.start(): AbortController
```

Chame `start()` antes de `fetchIA()` para obter o `AbortController` interno. Use `abort()` para cancelar a requisição em andamento:

```typescript
stream.abort(): void
```

> **Nota:** `start()` reseta o controller a cada chamada. Se você chamar `fetchIA()` sem `start()`, o controller é `undefined` e a requisição não poderá ser cancelada via `abort()`.

### Salvando resposta completa (onDone)

```typescript
stream.dataFetch({
    // ... config ...
    onDone: (finalData) => {
        console.log("Resposta completa:", finalData.chunks);
        // finalData.chunks → [{ content: "Olá" }, { content: " mundo" }, { content: "!" }]
        // Salve em banco de dados, arquivo, etc.
    },
});
```

### Pipe para arquivo

```typescript
import { createWriteStream } from "node:fs";

const generator = await stream.fetchIA({ encodeBytes: true });

const fileStream = createWriteStream("response.jsonl");
for await (const chunk of generator) {
    fileStream.write(chunk);
}
fileStream.end();
```

### Fallback não-streaming

Se a resposta não for `text/event-stream`, `fetchIA()` retorna o JSON parseado diretamente. Extratores **não** são aplicados — o objeto retornado é o JSON bruto:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-seu-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Olá" }],
        stream: false,
    },
});

const result = await stream.fetchIA();
console.log(result.choices?.[0]?.message?.content);
```

### Múltiplos provedores

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-openai-..." },
    timeOut: 30000,
});

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

## Como funciona internamente

### Fluxo geral

```
dataFetch()
    |
    ↓
fetchIA()
    |
    ↓
beforeRequest() — opcional: modifica url, headers, body
    |
    ↓
fetch() com url, headers, body
    |
    ↓
Content-Type: text/event-stream?
    |
    ├── sim ──▶ streamIA()
    |               |
    |               ↓
    |        while(true) lê ReadableStream (bodyReader.read())
    |               |
    |               ↓
    |        decoder.decode() → buffer.add()
    |               |
    |               ↓
    |        serialize()
    |               |
    |               ├── divide buffer por "\n\n" (mensagens SSE)
    |               ├── para cada mensagem:
    |               |   ├── detecta "data: [DONE]" → retorna
    |               |   ├── interpreta linha "data: ..." → JSON.parse
    |               |   ├── interpreta linha "event: ..." → string
    |               |   └── GetValueExtract(sseObject, state)
    |               |           ├── defaultExtract: percorre entries
    |               |           |   → getValueByPath(sseObject, forExtract)
    |               |           |   → state.setState({ [key]: value })
    |               |           └── conditionalxtractor: percorre entries
    |               |               → getValueByPath(sseObject, path)
    |               |               → se === condition, state.setState({ [key]: value })
    |               |
    |               ↓
    |        timeout() — reseta timer de inatividade
    |               |
    |               ↓
        |        Serializa extractedValues com JSON.stringify
        |        e monta "data: {JSON}\\n\\n"
        |               |
        |               ↓
        |        yield chunk (string | Uint8Array)
    |               |
    |               ↓
    |        clearState() — limpa state para o próximo chunk
    |               |
    |               ↓
    |        [loop repete até done ou "data: [DONE]"]
    |               |
    |               ↓
    |        onDone({ chunks }) — stream finalizado (array de objetos extraídos)
    |               |
    |               ↓
    |        finally: releaseLock() + clearTimeout()
    |
    └── não ──▶ retorna fetcher.json() (objeto JS)
```

### Etapas detalhadas

**1. `dataFetch()`** — armazena a configuração (url, headers, body, extractors, timeout, onDone, beforeRequest, accumulate) em propriedades privadas da instância.

**2. `beforeRequest()`** — se configurado, a função `beforeRequest` é executada com `{ url, headers, body }`. Os valores retornados (se houver) substituem os originais.

**3. `fetchIA()`** — executa `fetch()` com a URL, headers e body (modificados pelo `beforeRequest`, se aplicável). Verifica o `Content-Type` da resposta:

- Se `text/event-stream`: retorna o `AsyncGenerator` de `streamIA()`
- Caso contrário: retorna `fetcher.json()` (objeto JS parseado)

**4. `streamIA()`** — obtém um `ReadableStreamDefaultReader` e entra em loop infinito. A cada iteração:

- Lê bytes do stream com `bodyReader.read()`
- Decodifica com `TextDecoder` e adiciona ao buffer interno
- Chama `serialize()` para processar o buffer
- Chama `timeout()` para resetar o timer de inatividade
- Verifica se encontrou `"data: [DONE]"`
- Monta o chunk com os valores extraídos e faz yield

**5. `bufferControl()`** — closure que mantém um buffer de string. Métodos:

- `getBuffer()`: retorna o buffer atual
- `setBuffer(data)`: substitui o buffer
- `add(data)`: concatena dados ao buffer

**6. `serialize()`** — divide o buffer por `\n\n` (delimitador de mensagens SSE). A última parte (incompleta) volta ao buffer. Para cada mensagem completa:

- Divide por `\n`
- Interpreta linhas começando com `data:` (JSON) e `event:` (string)
- Se encontra `"data: [DONE]"`, retorna a string imediatamente para interromper o stream
- Chama `GetValueExtract()` para cada mensagem

**7. `GetValueExtract()`** — para cada objeto SSE parseado, aplica os extractors configurados:
- `defaultExtract`: percorre cada entrada, navega o objeto com `getValueByPath` usando `forExtract`. Se `accumulate` for `true`, concatena em um **único acumulador compartilhado** para todas as chaves do `defaultExtract`; senão, salva o valor bruto no state

- `conditionalxtractor`: percorre cada entrada, navega o objeto com `getValueByPath` usando `path`. Se `accumulate` for `true`, concatena em um **único acumulador compartilhado** para todas as chaves do `conditionalxtractor`. Só salva no state se o valor for estritamente igual a `condition`

**8. `getValueByPath(obj, path)`** — navega por um objeto usando um caminho como `"data.choices[0].delta.content"`. Suporta pontos e colchetes. Retorna `undefined` se o caminho não existir.

**9. `stateLocal()`** — closure baseada em `Map<string, unknown>` que mantém o estado entre chamadas. Métodos:

- `getStateOne(key)`: retorna o valor de uma chave
- `setState(newState)`: mescla um objeto no state
- `clearState()`: limpa todo o state

**10. `timeOutControl()` + `timeout()`** — gerenciam um timer de inatividade. Se o tempo entre chunks exceder `timeOut`, o `bodyReader` é cancelado. O timer reseta a cada chunk.

**11. Montagem do chunk** — após extrair os valores, o código:

- Pega todas as keys de `defaultExtract` + `conditionalxtractor`
- Busca cada valor no state via `getStateOne()`
- Se `accumulate` global for `true`, acumula os valores em uma string contínua (`acumulateValue`) e usa `JSON.parse` para o chunk final
- Se nenhuma key tiver valor (`hasValue === false`), o chunk é pulado (`continue`)
- Serializa o objeto `extractedValues` com `JSON.stringify` e adiciona `\n\n`
- Monta a saída no formato SSE: `data: ${JSON.stringify(extractedValues)}\n\n`
- Faz yield da string (ou `Uint8Array` se `encodeBytes: true`)
- O objeto extraído é acumulado via `push` em `chunks` (array de objetos) para uso no `onDone`

**12. `clearState()`** — após yield, o state é completamente limpo para o próximo chunk não acumular dados obsoletos.

**13. Finalização** — quando o stream termina (reader retorna `done: true` ou mensagem `"data: [DONE]"`):

- Se `chunks` (array) não estiver vazio, `onDone` é chamado com `{ chunks }` — cada elemento é um objeto com as keys extraídas
- No `finally`: `releaseLock()` no reader e `clearTimeout()` no timer de inatividade

---

## Builders por Provedor

### DeepSeek

Importe de `@felipe-lib/stream-http-event/builders-providers/deepseek`:

- `DeepSeekHeadersBuilder` — headers com apiKey
- `DeepSeekBodyBuilder` — corpo da requisição completo. Métodos: `model()`, `messages()`, `thinking()`, `maxTokens()`, `responseFormat()`, `stop()`, `stream()`, `streamOptions()`, `temperature()`, `topP()`, `tools()`, `toolChoice()`, `logprobs()`, `topLogprobs()`, `userId()`
- `DeepSeekMessageBuilder` — mensagem individual (role, content, tool_call_id, prefix, reasoning_content)
- `DeepSeekThinkingBuilder` — configuração de thinking (type, reasoning_effort)
- `DeepSeekResponseFormatBuilder` — formato de resposta (text, json_object)
- `DeepSeekToolBuilder` — definição de ferramenta (name, description, parameters, strict)
- `DeepSeekToolParametersBuilder` — parâmetros da ferramenta (properties, required)

> Cada builder DeepSeek exporta sua própria interface de retorno: `DeepSeekBody`, `DeepSeekMessageBuild`, `DeepSeekThink`, `DeepSeekReasonEffort`, `DeepSeekResponseFmt`, `DeepSeekToolParam`, `DeepSeekToolBuild`.

### Anthropic

Importe de `@felipe-lib/stream-http-event/builders-providers/anthropic`:

- `AnthropicHeadersBuilder` — headers com apiKey e versão. Métodos: `apiKey()`, `version()`
- `AnthropicBodyBuilder` — corpo da requisição. Métodos: `messages()`, `model()`, `maxTokens()`, `system()`, `thinking()`, `cacheControl()`, `container()`, `inferenceGeo()`, `metadata()`, `outputConfig()`, `serviceTier()`, `stopSequences()`, `stream()`, `tools()`, `toolChoice()`, `userProfileId()`
- `AnthropicMessageBuilder` — mensagem individual (role, content)
- `AnthropicThinkingBuilder` — configuração de thinking (type, budget_tokens, display)
- `AnthropicInputSchemaBuilder` — schema de entrada da ferramenta (properties, required)
- `AnthropicToolBuilder` — definição de ferramenta (name, description, inputSchema, strict, ...)

> Cada builder Anthropic exporta sua própria interface de retorno: `AnthropicBody`, `AnthropicMessage`, `AnthropicThinking`, `AnthropicInputSchemaBuild`, `AnthropicToolBuild`.

---

## Tipos TypeScript públicos

```typescript
interface dataFetchType<
    H extends Record<string, string> = Record<string, string>,
    B extends Record<string, unknown> = Record<string, unknown>,
> {
    url: string;
    headers?: H;
    timeOut?: number;
    onDone?: (finalData: { chunks: Record<string, unknown>[] }) => void;
    body?: B;
    extractors?: ExtractorsType;
    beforeRequest?: BeforeRequestFn;
    accumulate?: boolean;
}

interface FetchOptions {
    encodeBytes?: boolean;
    method?: string;
}

interface ExtractorsType {
    defaultExtract: extract[];
    conditionalxtractor?: condicionalExtract[];
}

interface extract {
    key: string;
    forExtract: string;
    accumulate?: boolean;
}

interface condicionalExtract {
    key: string;
    path: string;
    accumulate?: boolean;
    condition: string;
}

interface BeforeRequestConfig {
    url: string;
    headers: Record<string, string>;
    body?: Record<string, unknown>;
}

type BeforeRequestFn = (
    config: BeforeRequestConfig,
) => Promise<BeforeRequestConfig | void>;
```

> Todos os tipos acima também podem ser importados de `@felipe-lib/stream-http-event/type`, que adicionalmente exporta o enum `SystemError` e o objeto `systemErrorDescription` com descrições de erros do sistema em português.

---

Além disso, cada builder de provedor exporta sua interface de retorno:

**Anthropic:**
```typescript
import type { AnthropicBody, AnthropicMessage, AnthropicThinking, AnthropicInputSchemaBuild, AnthropicToolBuild, AnthropicToolUnion, ToolChoice, Tool }
    from "@felipe-lib/stream-http-event/builders-providers/anthropic";
```

**DeepSeek:**
```typescript
import type { DeepSeekBody, DeepSeekMessageBuild, DeepSeekThink, DeepSeekResponseFmt, DeepSeekToolParam, DeepSeekToolBuild }
    from "@felipe-lib/stream-http-event/builders-providers/deepseek";
```

---

## Filosofia

Esta biblioteca tem um propósito único e focado: **consumir streams HTTP/SSE** de provedores de IA com zero dependências. Não pretende ser um SDK completo — embedding, contagem de tokens, cache, rate limit, etc. são responsabilidades de outras camadas.

A arquitetura é deliberadamente enxuta para que você possa estender sem lutar contra o design. Use os dados crus do `for await` ou o array de objetos do `onDone` para construir o que precisar por cima — sem que a lib atrapalhe.

Features, correções e extensões feitas por outros devs são **bem-vindas**. O projeto aceita contributions via PRs e issues, desde que mantenham o escopo focado e não adicionem dependências desnecessárias.

---

## Projeto Estudantil

Este é um projeto de estudo e aprendizado. Está funcional e em uso, mas pode conter imperfeições. Contribuições e sugestões são bem-vindas!

---

# English

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [What Changed?](#what-changed)
- [API Reference](#api-reference)
    - [`dataFetch()`](#datafetch-1)
    - [`ExtractorsType`](#extractortype-1)
    - [`fetchIA()`](#fetchia-1)
    - [`start()` and `abort()`](#start-and-abort)
- [Examples](#examples)
    - [OpenAI Streaming](#openai-streaming)
    - [DeepSeek with Builders](#deepseek-with-builders)
    - [Anthropic](#anthropic-2)
    - [Cancellation](#cancellation)
    - [Saving the Full Response (onDone)](#saving-the-full-response-ondon)
    - [Pipe to File](#pipe-to-file)
    - [Non-Streaming Fallback](#non-streaming-fallback)
    - [Multiple Providers](#multiple-providers)
- [How It Works Internally](#how-it-works-internally)
- [Provider Builders](#provider-builders)
    - [DeepSeek](#deepseek-1)
    - [Anthropic](#anthropic-3)
- [Public TypeScript Types](#public-typescript-types)
- [Student Project](#student-project)

---

## Installation

```bash
npm install @felipe-lib/stream-http-event
# or
pnpm add @felipe-lib/stream-http-event
```

---

## Quick Start

```typescript
import { StreamHttpEvent } from "@felipe-lib/stream-http-event";

const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-your-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

Each chunk output looks like:

```
data: {"content":"Hello"}

```

---

## What Changed?

This section documents the main changes from the previous API version.

### Extractors

| Before                                                  | After                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `extractor: [{ fn: ({ data }) => ({ content: ... }) }]` | `extractors: { defaultExtract: [{ key: "content", forExtract: "data.choices[0].delta.content" }] }` |

The old API used JavaScript functions to extract data. The new one uses **path strings** that navigate the JSON object, making configuration declarative and serializable.

### Key lookup in stream

| Before                                                                                          | After                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Hardcoded `state.getStateOne("extracted")` — only worked if the extractor key was `"extracted"` | **Dynamic loop** — iterates over **all** keys in `defaultExtract` and `conditionalxtractor`, building the output with each one |

### Output format

| Before                                                     | After                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Always `data: {...}\nevent: ...\n\n` (standard SSE format) | Always `data: { "key": "value" }\n\n` (JSON of the whole extracted object) |

### Removed code

- `onData` and `onEvent` — declared but never called
- `try { ... } catch (e) { throw e }` — redundant blocks

### Fixed bugs

- `if (value)` is now `if (value !== undefined)` — values `0`, `""`, `false` are no longer ignored
- `types.anthropic.ts`: field `ccontent` corrected to `content` (typo)
- `types.anthropic.ts`: duplicate removed from union type

### v2.2.1

**`accumulate`** — new accumulation flag for extracted values. Available in three levels:

- **Global** (`dataFetchType.accumulate`): accumulates all chunks into a continuous string in the final output
- **Standard extract** (`extract.accumulate`): when enabled, values from **all keys** in `defaultExtract` are concatenated into a single shared string
- **Conditional extract** (`condicionalExtract.accumulate`): when enabled, values from **all keys** in `conditionalxtractor` are concatenated into a single shared string

**`start()` and `abort()`** — new public methods to manage the request lifecycle. Use `start()` to obtain the internal `AbortController` and `abort()` to cancel the request.

**`extractors` optional** — the `extractors` field in `dataFetchType` is now optional, allowing `fetchIA()` to be used for non-streaming calls without configuring extractors.

### v2.3.0

**`AnthropicInputSchemaBuilder`** and **`AnthropicToolBuilder`** — new builders for creating tool definitions in the Anthropic provider, analogous to the existing DeepSeek builders.

**`tools()`** and **`toolChoice()`** — new methods on `AnthropicBodyBuilder` to configure tools and tool choice in the request body.

**`AnthropicToolUnion`** — new exported type alias that unions all Anthropic tool types (custom + server tools).

**`tools`** — added to `MessageCreateParamsBase` as `AnthropicToolUnion[]`.

### v2.2.3

Fixed typo `acumullate` → `accumulate` across the entire codebase (private property, `dataFetch()` parameter, `extract` and `condicionalExtract` interfaces, and `dataFetchType`).

---

## API Reference

### `dataFetch()`

Configures the instance. Must be called before `fetchIA()`.

```typescript
stream.dataFetch<H, B>(config: dataFetchType<H, B>): void
```

| Parameter       | Type                                                      | Required | Description                                                                                       |
| --------------- | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `url`           | `string`                                                  | Yes      | AI provider endpoint                                                                              |
| `headers`       | `Record<string, string>`                                  | No       | HTTP headers. Can be typed via provider builder                                                   |
| `body`          | `Record<string, unknown>`                                 | No       | Request body (serialized as JSON)                                                                 |
| `timeOut`       | `number`                                                  | No       | Inactivity timeout in milliseconds. Resets on each chunk                                          |
| `onDone`        | `(finalData: { chunks: Record<string, unknown>[] }) => void` | No    | Callback fired when the stream ends. Receives `{ chunks }` — array of extracted objects per chunk |
| `extractors`    | `ExtractorsType`                                          | No       | Extractor configuration                                                                           |
| `beforeRequest` | `BeforeRequestFn`                                         | No       | Async function executed before fetch. Receives `{ url, headers, body }` and can modify each field. If it returns `void`, original values are kept |
| `accumulate`    | `boolean`                                                 | No       | If `true`, accumulates extracted values from all chunks into a continuous string in the output     |

---

### `ExtractorsType`

```typescript
interface ExtractorsType {
    defaultExtract: extract[];
    conditionalxtractor?: condicionalExtract[];
}

interface extract {
    key: string;
    forExtract: string;
    accumulate?: boolean;
}

interface condicionalExtract {
    key: string;
    path: string;
    accumulate?: boolean;
    condition: string;
}
```

**`defaultExtract`** — always applied to each SSE message:

- `key`: the output key name, also used internally in state
- `forExtract`: JSON path to navigate to the desired value (e.g. `"data.choices[0].delta.content"`)
- `accumulate`: if `true`, the extracted value is concatenated into an accumulator **shared across all keys** in `defaultExtract`
- Supports dot and bracket notation: `"data.choices[0].delta.content"`

**`conditionalxtractor`** — only applied if the condition is met:

- `key`: output key name
- `path`: JSON path to navigate to the value
- `accumulate`: if `true`, the extracted value is concatenated with previous values of the same key
- `condition`: expected value. If the value at `path` strictly equals `condition`, the value is extracted

**Key merging:** keys from both `defaultExtract` and `conditionalxtractor` are combined. If both arrays have entries, **all** keys are used in the output.

---

### `fetchIA()`

Executes the HTTP request and returns an `AsyncGenerator` or a parsed JSON object.

```typescript
stream.fetchIA(options: FetchOptions): Promise<any>
```

| Parameter     | Type      | Default  | Description                                                                |
| ------------- | --------- | -------- | -------------------------------------------------------------------------- |
| `method`      | `string`  | `"POST"` | HTTP method                                                                |
| `encodeBytes` | `boolean` | `false`  | If `true`, yielded chunks are `Uint8Array`. If `false`, chunks are strings |

**Returns:**

- `AsyncGenerator<string | Uint8Array, void, unknown>` — if `Content-Type` is `text/event-stream`
- `Record<string, unknown>` — parsed JSON for non-streaming responses

---

## Examples

### OpenAI Streaming

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
        Authorization: "Bearer sk-your-token",
        "Content-Type": "application/json",
    },
    timeOut: 30000,
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Explain SSE" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### DeepSeek with Builders

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
    extractors: {
        defaultExtract: [
            { key: "content", forExtract: "data.choices[0].delta.content" },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### Anthropic

Anthropic uses a different SSE format. Example with `defaultExtract` + `conditionalxtractor`:

```typescript
const stream = new StreamHttpEvent();

stream.dataFetch({
    url: "https://api.anthropic.com/v1/messages",
    headers: {
        "x-api-key": "sk-ant-your-token",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    },
    timeOut: 30000,
    body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
    },
    extractors: {
        defaultExtract: [{ key: "text", forExtract: "data.delta.text" }],
        conditionalxtractor: [
            {
                key: "eventType",
                path: "data.type",
                condition: "content_block_delta",
            },
        ],
    },
});

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    process.stdout.write(chunk);
}
```

### Cancellation

Use `start()` to get the `AbortController` and `abort()` to cancel:

```typescript
const controller = stream.start();
setTimeout(() => stream.abort(), 5000);

const generator = await stream.fetchIA();

for await (const chunk of generator) {
    console.log(chunk);
}
```

Via `break` in the loop:

```typescript
const generator = await stream.fetchIA();

let count = 0;
for await (const chunk of generator) {
    console.log(chunk);
    count++;
    if (count >= 10) break;
}
```

### `start()` and `abort()`

Manage the request lifecycle:

```typescript
stream.start(): AbortController
```

Call `start()` before `fetchIA()` to obtain the internal `AbortController`. Use `abort()` to cancel the ongoing request:

```typescript
stream.abort(): void
```

> **Note:** `start()` resets the controller on each call. If you call `fetchIA()` without `start()`, the controller is `undefined` and the request cannot be cancelled via `abort()`.

### Saving the Full Response (onDone)

```typescript
stream.dataFetch({
    // ... config ...
    onDone: (finalData) => {
        console.log("Full response:", finalData.chunks);
        // finalData.chunks → [{ content: "Hello" }, { content: " world" }, { content: "!" }]
        // Save to database, file, etc.
    },
});
```

### Pipe to File

```typescript
import { createWriteStream } from "node:fs";

const generator = await stream.fetchIA({ encodeBytes: true });

const fileStream = createWriteStream("response.jsonl");
for await (const chunk of generator) {
    fileStream.write(chunk);
}
fileStream.end();
```

### Non-Streaming Fallback

If the response is not `text/event-stream`, `fetchIA()` returns the parsed JSON directly. Extractors are **not** applied — the returned object is the raw JSON:

```typescript
stream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-your-token" },
    body: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
    },
});

const result = await stream.fetchIA();
console.log(result.choices?.[0]?.message?.content);
```

### Multiple Providers

```typescript
const openaiStream = new StreamHttpEvent();
openaiStream.dataFetch({
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "Bearer sk-openai-..." },
    timeOut: 30000,
});

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

## How It Works Internally

### General flow

```
dataFetch()
    |
    ↓
fetchIA()
    |
    ↓
beforeRequest() — optional: modifies url, headers, body
    |
    ↓
fetch() with url, headers, body
    |
    ↓
Content-Type: text/event-stream?
    |
    ├── yes ──▶ streamIA()
    |               |
    |               ↓
    |        while(true) reads ReadableStream (bodyReader.read())
    |               |
    |               ↓
    |        decoder.decode() → buffer.add()
    |               |
    |               ↓
    |        serialize()
    |               |
    |               ├── splits buffer by "\n\n" (SSE messages)
    |               ├── for each message:
    |               |   ├── detects "data: [DONE]" → returns
    |               |   ├── parses "data: ..." line → JSON.parse
    |               |   ├── parses "event: ..." line → string
    |               |   └── GetValueExtract(sseObject, state)
    |               |           ├── defaultExtract: iterates entries
    |               |           |   → getValueByPath(sseObject, forExtract)
    |               |           |   → state.setState({ [key]: value })
    |               |           └── conditionalxtractor: iterates entries
    |               |               → getValueByPath(sseObject, path)
    |               |               → if === condition, state.setState({ [key]: value })
    |               |
    |               ↓
    |        timeout() — resets inactivity timer
    |               |
    |               ↓
        |        Serializes extractedValues with JSON.stringify
        |        and builds "data: {JSON}\\n\\n"
        |               |
        |               ↓
        |        yield chunk (string | Uint8Array)
    |               |
    |               ↓
    |        clearState() — clears state for next chunk
    |               |
    |               ↓
    |        [loop repeats until done or "data: [DONE]"]
    |               |
    |               ↓
    |        onDone({ chunks }) — stream finished (array of extracted objects)
    |               |
    |               ↓
    |        finally: releaseLock() + clearTimeout()
    |
    └── no ──▶ returns fetcher.json() (JS object)
```

### Detailed steps

**1. `dataFetch()`** — stores the configuration (url, headers, body, extractors, timeout, onDone, beforeRequest, accumulate) in private instance properties.

**2. `beforeRequest()`** — if configured, the `beforeRequest` function is called with `{ url, headers, body }`. Returned values (if any) override the originals.

**3. `fetchIA()`** — executes `fetch()` with the URL, headers and body (modified by `beforeRequest` if applicable). Checks the response `Content-Type`:

- If `text/event-stream`: returns the `AsyncGenerator` from `streamIA()`
- Otherwise: returns `fetcher.json()` (parsed JS object)

**4. `streamIA()`** — obtains a `ReadableStreamDefaultReader` and enters an infinite loop. Each iteration:

- Reads bytes from the stream with `bodyReader.read()`
- Decodes with `TextDecoder` and adds to the internal buffer
- Calls `serialize()` to process the buffer
- Calls `timeout()` to reset the inactivity timer
- Checks for `"data: [DONE]"`
- Builds the chunk with extracted values and yields

**5. `bufferControl()`** — closure maintaining a string buffer. Methods:

- `getBuffer()`: returns the current buffer
- `setBuffer(data)`: replaces the buffer
- `add(data)`: appends data to the buffer

**6. `serialize()`** — splits the buffer by `\n\n` (SSE message delimiter). The last (incomplete) part goes back to the buffer. For each complete message:

- Splits by `\n`
- Parses lines starting with `data:` (JSON) and `event:` (string)
- If `"data: [DONE]"` is found, returns immediately to stop the stream
- Calls `GetValueExtract()` for each message

**7. `GetValueExtract()`** — for each parsed SSE object, applies the configured extractors:

- `defaultExtract`: iterates each entry, navigates the object with `getValueByPath` using `forExtract`. If `accumulate` is `true`, concatenates into a **single shared accumulator** for all keys in `defaultExtract`; otherwise saves the raw value to state
- `conditionalxtractor`: iterates each entry, navigates the object with `getValueByPath` using `path`. If `accumulate` is `true`, concatenates into a **single shared accumulator** for all keys in `conditionalxtractor`. Only saves to state if the value strictly equals `condition`

**8. `getValueByPath(obj, path)`** — navigates an object using a path like `"data.choices[0].delta.content"`. Supports dots and brackets. Returns `undefined` if the path doesn't exist.

**9. `stateLocal()`** — `Map<string, unknown>`-based closure that maintains state between calls. Methods:

- `getStateOne(key)`: returns the value for a key
- `setState(newState)`: merges an object into state
- `clearState()`: clears all state

**10. `timeOutControl()` + `timeout()`** — manage an inactivity timer. If the time between chunks exceeds `timeOut`, the `bodyReader` is cancelled. The timer resets on each chunk.

**11. Chunk assembly** — after extracting values, the code:

- Gets all keys from `defaultExtract` + `conditionalxtractor`
- Looks up each value in state via `getStateOne()`
- If global `accumulate` is `true`, accumulates values into a continuous string (`acumulateValue`) and uses `JSON.parse` for the final chunk
- If no key has a value (`hasValue === false`), the chunk is skipped (`continue`)
- Serializes the `extractedValues` object with `JSON.stringify` and appends `\n\n`
- Builds the SSE output: `data: ${JSON.stringify(extractedValues)}\n\n`
- Yields the string (or `Uint8Array` if `encodeBytes: true`)
- The extracted object is pushed into `chunks` array (object accumulation) for use in `onDone`

**12. `clearState()`** — after yielding, the state is fully cleared so the next chunk doesn't carry stale data.

**13. Finalization** — when the stream ends (reader returns `done: true` or `"data: [DONE]"` message):

- If `chunks` (array) is not empty, `onDone` is called with `{ chunks }` — each element is an object with the extracted keys
- In `finally`: `releaseLock()` on the reader and `clearTimeout()` on the inactivity timer

---

## Provider Builders

### DeepSeek

Import from `@felipe-lib/stream-http-event/builders-providers/deepseek`:

- `DeepSeekHeadersBuilder` — headers with apiKey
- `DeepSeekBodyBuilder` — full request body. Methods: `model()`, `messages()`, `thinking()`, `maxTokens()`, `responseFormat()`, `stop()`, `stream()`, `streamOptions()`, `temperature()`, `topP()`, `tools()`, `toolChoice()`, `logprobs()`, `topLogprobs()`, `userId()`
- `DeepSeekMessageBuilder` — individual message (role, content, tool_call_id, prefix, reasoning_content)
- `DeepSeekThinkingBuilder` — thinking configuration (type, reasoning_effort)
- `DeepSeekResponseFormatBuilder` — response format (text, json_object)
- `DeepSeekToolBuilder` — tool definition (name, description, parameters, strict)
- `DeepSeekToolParametersBuilder` — tool parameters (properties, required)

> Each DeepSeek builder exports its own return interface: `DeepSeekBody`, `DeepSeekMessageBuild`, `DeepSeekThink`, `DeepSeekReasonEffort`, `DeepSeekResponseFmt`, `DeepSeekToolParam`, `DeepSeekToolBuild`.

### Anthropic

Import from `@felipe-lib/stream-http-event/builders-providers/anthropic`:

- `AnthropicHeadersBuilder` — headers with apiKey and version. Methods: `apiKey()`, `version()`
- `AnthropicBodyBuilder` — request body. Methods: `messages()`, `model()`, `maxTokens()`, `system()`, `thinking()`, `cacheControl()`, `container()`, `inferenceGeo()`, `metadata()`, `outputConfig()`, `serviceTier()`, `stopSequences()`, `stream()`, `tools()`, `toolChoice()`, `userProfileId()`
- `AnthropicMessageBuilder` — individual message (role, content)
- `AnthropicThinkingBuilder` — thinking configuration (type, budget_tokens, display)
- `AnthropicInputSchemaBuilder` — tool input schema (properties, required)
- `AnthropicToolBuilder` — tool definition (name, description, inputSchema, strict, ...)

> Each Anthropic builder exports its own return interface: `AnthropicBody`, `AnthropicMessage`, `AnthropicThinking`, `AnthropicInputSchemaBuild`, `AnthropicToolBuild`.

---

## Public TypeScript Types

```typescript
interface dataFetchType<
    H extends Record<string, string> = Record<string, string>,
    B extends Record<string, unknown> = Record<string, unknown>,
> {
    url: string;
    headers?: H;
    timeOut?: number;
    onDone?: (finalData: { chunks: Record<string, unknown>[] }) => void;
    body?: B;
    extractors?: ExtractorsType;
    beforeRequest?: BeforeRequestFn;
    accumulate?: boolean;
}

interface FetchOptions {
    encodeBytes?: boolean;
    method?: string;
}

interface ExtractorsType {
    defaultExtract: extract[];
    conditionalxtractor?: condicionalExtract[];
}

interface extract {
    key: string;
    forExtract: string;
    accumulate?: boolean;
}

interface condicionalExtract {
    key: string;
    path: string;
    accumulate?: boolean;
    condition: string;
}

interface BeforeRequestConfig {
    url: string;
    headers: Record<string, string>;
    body?: Record<string, unknown>;
}

type BeforeRequestFn = (
    config: BeforeRequestConfig,
) => Promise<BeforeRequestConfig | void>;
```

> All types above can also be imported from `@felipe-lib/stream-http-event/type`, which additionally exports the `SystemError` enum and `systemErrorDescription` constant with system error descriptions.

---

Additionally, each provider builder exports its own return interface:

**Anthropic:**
```typescript
import type { AnthropicBody, AnthropicMessage, AnthropicThinking, AnthropicInputSchemaBuild, AnthropicToolBuild, AnthropicToolUnion, ToolChoice, Tool }
    from "@felipe-lib/stream-http-event/builders-providers/anthropic";
```

**DeepSeek:**
```typescript
import type { DeepSeekBody, DeepSeekMessageBuild, DeepSeekThink, DeepSeekResponseFmt, DeepSeekToolParam, DeepSeekToolBuild }
    from "@felipe-lib/stream-http-event/builders-providers/deepseek";
```

---

## Philosophy

This library has a single, focused purpose: **consuming HTTP/SSE streams** from AI providers with zero dependencies. It does not aim to be a full SDK — embedding, token counting, caching, rate limiting, etc. are responsibilities of other layers.

The architecture is deliberately lean so you can extend it without fighting the design. Use the raw data from `for await` or the object array from `onDone` to build whatever you need on top — without the library getting in the way.

Features, fixes, and extensions made by other devs are **welcome**. The project accepts contributions via PRs and issues, as long as they keep the scope focused and don't add unnecessary dependencies.

---

## Student Project

This is a study and learning project. It is functional and in use, but may contain imperfections. Contributions and suggestions are welcome!

---

## License

ISC
