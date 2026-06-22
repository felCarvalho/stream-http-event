export interface CitationCharLocationParam {
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_char_index: number;
    start_char_index: number;
    type: "char_location";
}

export interface CitationPageLocationParam {
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_page_number: number;
    start_page_number: number;
    type: "page_location";
}

export interface CitationContentBlockLocationParam {
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_block_index: number;
    start_block_index: number;
    type: "content_block_location";
}

export interface CitationWebSearchResultLocationParam {
    cited_text: string;
    encrypted_index: string;
    title: string | null;
    type: "web_search_result_location";
    url: string;
}

export interface CitationSearchResultLocationParam {
    cited_text: string;
    end_block_index: number;
    search_result_index: number;
    source: string;
    start_block_index: number;
    title: string | null;
    type: "search_result_location";
}

export interface TextBlockParam {
    text: string;
    type: "text";
    cache_control?: CacheControlEphemeral | null;
    citations?:
        | (
              | CitationCharLocationParam
              | CitationPageLocationParam
              | CitationSearchResultLocationParam
              | CitationWebSearchResultLocationParam
              | CitationContentBlockLocationParam
          )
        | null;
}

export interface Base64ImageSource {
    data: string;
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    type: "base64";
}

export interface URLImageSource {
    type: "url";
    url: string;
}

export interface ImageBlockParam {
    source: Base64ImageSource | URLImageSource;
    type: "image";
    cache_control?: CacheControlEphemeral | null;
}

export interface Base64PDFSource {
    data: string;
    media_type: "application/pdf";
    type: "base64";
}

export interface PlainTextSource {
    data: string;
    media_type: "text/plain";
    type: "text";
}

export interface ContentBlockSource {
    content: string | (TextBlockParam | ImageBlockParam)[];
    type: "content";
}

export interface URLPDFSource {
    type: "url";
    url: string;
}

export interface CitationsConfigParam {
    enabled?: boolean;
}

export interface DocumentBlockParam {
    source:
        | Base64PDFSource
        | PlainTextSource
        | URLPDFSource
        | ContentBlockSource;
    type: "document";
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
    context?: string | null;
    title?: string | null;
}

export interface SearchResultBlockParam {
    content: TextBlockParam[];
    source: string;
    title: string;
    type: "search_result";
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
}

export interface ThinkingBlockParam {
    signature: string;
    thinking: string;
    type: "thinking";
}

export interface RedactedThinkingBlockParam {
    data: string;
    type: "redacted_thinking";
}

export interface DirectCaller {
    type: "direct";
}

export interface ServerToolCaller {
    type: "code_execution_20250825";
    tool_id: string;
}

export interface ServerToolCaller20260120 {
    type: "code_execution_20260120";
    tool_id: string;
}

export interface ToolUseBlockParam {
    id: string;
    input: Record<string, unknown>;
    name: string;
    type: "tool_use";
    cache_control?: CacheControlEphemeral | null;
    caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface ToolReferenceBlockParam {
    tool_name: string;
    type: "tool_reference";
    cache_control?: CacheControlEphemeral | null;
}

export interface ToolResultBlockParam {
    tool_use_id: string;
    type: "tool_result";
    cache_control?: CacheControlEphemeral | null;
    content?:
        | string
        | (
              | TextBlockParam
              | ImageBlockParam
              | SearchResultBlockParam
              | DocumentBlockParam
              | ToolReferenceBlockParam
          );
    is_error?: boolean;
}

export interface ServerToolUseBlockParam {
    id: string;
    input: Record<string, unknown>;
    name:
        | "web_search"
        | "web_fetch"
        | "code_execution"
        | "bash_code_execution"
        | "text_editor_code_execution"
        | "tool_search_tool_regex"
        | "tool_search_tool_bm25";
    type: "server_tool_use";
    cache_control?: CacheControlEphemeral | null;
    caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface WebSearchToolResultBlockParamContent {
    encrypted_content: string;
    title: string;
    type: "web_search_result";
    url: string;
    page_age?: string | null;
}

export type WebSearchToolResultErrorCode =
    | "invalid_tool_input"
    | "unavailable"
    | "max_uses_exceeded"
    | "too_many_requests"
    | "query_too_long"
    | "request_too_large";

export interface WebSearchToolRequestError {
    error_code: WebSearchToolResultErrorCode;
    type: "web_search_tool_result_error";
}

export interface WebSearchToolResultBlockParam {
    content: WebSearchToolResultBlockParamContent | WebSearchToolRequestError;
    tool_use_id: string;
    type: "web_search_tool_result";
    cache_control?: CacheControlEphemeral | null;
    caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type WebFetchToolResultErrorCode =
    | "invalid_tool_input"
    | "url_too_long"
    | "url_not_allowed"
    | "url_not_in_prior_context"
    | "url_not_accessible"
    | "unsupported_content_type"
    | "too_many_requests"
    | "max_uses_exceeded"
    | "unavailable";

export interface WebFetchToolResultErrorBlockParam {
    error_code: WebFetchToolResultErrorCode;
    type: "web_fetch_tool_result_error";
}

export interface WebFetchBlockParam {
    content: DocumentBlockParam;
    type: "web_fetch_result";
    url: string;
    retrieved_at?: string | null;
}
export interface WebFetchToolResultBlockParam {
    content: WebFetchToolResultErrorBlockParam | WebFetchBlockParam;
    tool_use_id: string;
    type: "web_fetch_tool_result";
    cache_control?: CacheControlEphemeral | null;
    caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type CodeExecutionToolResultErrorCode =
    | "invalid_tool_input"
    | "unavailable"
    | "too_many_requests"
    | "execution_time_exceeded";

export interface CodeExecutionToolResultErrorParam {
    error_code: CodeExecutionToolResultErrorCode;
    type: "code_execution_tool_result_error";
}

export interface CodeExecutionOutputBlockParam {
    file_id: string;
    type: "code_execution_output";
}

export interface CodeExecutionResultBlockParam {
    content: CodeExecutionOutputBlockParam[];
    return_code: number;
    stderr: string;
    stdout: string;
    type: "code_execution_result";
}

export interface EncryptedCodeExecutionResultBlockParam {
    content: Array<CodeExecutionOutputBlockParam>;
    encrypted_stdout: string;
    return_code: number;
    stderr: string;
    type: "encrypted_code_execution_result";
}

export type CodeExecutionToolResultBlockParamContent =
    | CodeExecutionToolResultErrorParam
    | EncryptedCodeExecutionResultBlockParam;

export interface CodeExecutionToolResultBlockParam {
    content: CodeExecutionToolResultBlockParamContent;
    tool_use_id: string;
    type: "code_execution_tool_result";
    cache_control?: CacheControlEphemeral | null;
}

export type ContentBlockParam =
    | TextBlockParam
    | ImageBlockParam
    | DocumentBlockParam
    | ThinkingBlockParam
    | RedactedThinkingBlockParam
    | ToolUseBlockParam
    | ToolResultBlockParam
    | ToolReferenceBlockParam
    | SearchResultBlockParam
    | ServerToolUseBlockParam
    | WebSearchToolResultBlockParam
    | WebFetchToolResultBlockParam
    | CodeExecutionToolResultBlockParam;

export interface Messages {
    role: "user" | "assistant";
    content: string | ContentBlockParam[];
}

export interface FormatResponse {
    effort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
    format?: {
        schema: Record<string, unknown>;
        type: "json_schema";
    } | null;
}

export interface CacheControlEphemeral {
    type: "ephemeral";
    ttl?: "5m" | "1h";
}

export interface ToolChoiceAuto {
    type: "auto";
}

export interface ToolChoiceAny {
    type: "any";
}

export interface ToolChoiceTool {
    type: "tool";
    name: string;
    disable_parallel_tool_use?: boolean;
}

export type ToolChoice = ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool;

export interface ThinkingConfigEnabled {
    type: "enabled";
    budget_tokens: number;
}

export interface ThinkingConfigDisabled {
    type: "disabled";
}

export type ThinkingConfigParam =
    | ThinkingConfigEnabled
    | ThinkingConfigDisabled;

export interface MessageCreateParamsBase {
    max_tokens: number;
    messages: Messages[];
    model: Modelo;
    system?: string | TextBlockParam[];
    //temperature?: number;
    //top_p?: number;
    //top_k?: number;
    thinking?: ThinkingConfigParam;
    //tools?: (ToolUseBlockParam | ServerToolUseBlockParam)[];
    //tool_choice?: ToolChoice;
    cache_control?: CacheControlEphemeral | null;
    container?: string | null;
    inference_geo?: string | null;
    metadata?: {
        user_id?: string | null;
    };
    output_config?: FormatResponse;
    service_tier?: "auto" | "standard_only";
    stop_sequences?: string[];
    stream?: boolean;
}

export type Modelo =
    | "claude-fable-5"
    | "claude-mythos-5"
    | "claude-opus-4-8"
    | "claude-opus-4-7"
    | "claude-mythos-preview"
    | "claude-opus-4-6"
    | "claude-sonnet-4-6"
    | "claude-haiku-4-5"
    | "claude-haiku-4-5-20251001"
    | "claude-opus-4-5"
    | "claude-opus-4-5-20251101"
    | "claude-sonnet-4-5"
    | "claude-sonnet-4-5-20250929"
    | "claude-opus-4-1"
    | "claude-opus-4-1-20250805"
    | "claude-opus-4-0"
    | "claude-opus-4-20250514"
    | "claude-sonnet-4-0"
    | "claude-sonnet-4-20250514"
    | "claude-3-haiku-20240307";
