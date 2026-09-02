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
        Base64PDFSource | PlainTextSource | URLPDFSource | ContentBlockSource;
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
    content: WebSearchToolResultBlockParamContent[] | WebSearchToolRequestError;
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
    CodeExecutionToolResultErrorParam | EncryptedCodeExecutionResultBlockParam;

export interface CodeExecutionToolResultBlockParam {
    content: CodeExecutionToolResultBlockParamContent;
    tool_use_id: string;
    type: "code_execution_tool_result";
    cache_control?: CacheControlEphemeral | null;
}

export type BashCodeExecutionToolResultErrorCode =
    | "invalid_tool_input"
    | "unavailable"
    | "too_many_requests"
    | "execution_time_exceeded"
    | "output_file_too_large";

export interface BashCodeExecutionToolResultErrorParam {
    error_code: BashCodeExecutionToolResultErrorCode;
    type: "bash_code_execution_tool_result_error";
}

export interface BashCodeExecutionOutputBlockParam {
    file_id: string;
    type: "bash_code_execution_output";
}

export interface BashCodeExecutionResultBlockParam {
    content: BashCodeExecutionOutputBlockParam;
    return_code: number;
    stderr: string;
    stdout: string;
    type: "bash_code_execution_result";
}

export type Content_BashCodeExecutionToolResultBlockParam =
    BashCodeExecutionToolResultErrorParam | BashCodeExecutionResultBlockParam;

export interface BashCodeExecutionToolResultBlockParam {
    content: Content_BashCodeExecutionToolResultBlockParam;
    tool_use_id: string;
    type: "bash_code_execution_tool_result";
    cache_control: CacheControlEphemeral;
}

export type TextEditorCodeExecutionToolResultErrorCode =
    | "invalid_tool_input"
    | "unavailable"
    | "too_many_requests"
    | "execution_time_exceeded"
    | "file_not_found";

export interface TextEditorCodeExecutionToolResultErrorParam {
    error_code: TextEditorCodeExecutionToolResultErrorCode;
    type: "text_editor_code_execution_tool_result_error";
    error_message?: string | null;
}

export interface TextEditorCodeExecutionViewResultBlockParam {
    content: string;
    file_type: "text" | "image" | "pdf";
    type: "text_editor_code_execution_view_result";
    num_lines?: number | null;
    start_line?: number | null;
    total_lines?: number | null;
}

export interface TextEditorCodeExecutionCreateResultBlockParam {
    is_file_update: boolean;
    type: "text_editor_code_execution_create_result";
}

export interface TextEditorCodeExecutionStrReplaceResultBlockParam {
    type: "text_editor_code_execution_str_replace_result";
    lines?: Array<string> | null;
    new_lines?: number | null;
    new_start?: number | null;
    old_lines?: number | null;
    old_start?: number | null;
}

export interface TextEditorCodeExecutionToolResultBlockParam {
    content:
        | TextEditorCodeExecutionToolResultErrorParam
        | TextEditorCodeExecutionViewResultBlockParam
        | TextEditorCodeExecutionCreateResultBlockParam
        | TextEditorCodeExecutionStrReplaceResultBlockParam;
    tool_use_id: string;
    type: "text_editor_code_execution_tool_result";
    cache_control?: CacheControlEphemeral | null;
}

export type ToolSearchToolResultErrorCode =
    | "invalid_tool_input"
    | "unavailable"
    | "too_many_requests"
    | "execution_time_exceeded";

export interface ToolSearchToolResultErrorParam {
    error_code: ToolSearchToolResultErrorCode;
    type: "tool_search_tool_result_error";
    error_message?: string | null;
}

export interface ToolSearchToolSearchResultBlockParam {
    tool_references: Array<ToolReferenceBlockParam>;
    type: "tool_search_tool_search_result";
}

export interface ToolSearchToolResultBlockParam {
    content:
        ToolSearchToolResultErrorParam | ToolSearchToolSearchResultBlockParam;
    tool_use_id: string;
    type: "tool_search_tool_result";
    cache_control?: CacheControlEphemeral | null;
}

export interface ContainerUploadBlockParam {
    file_id: string;
    type: "container_upload";
    cache_control?: CacheControlEphemeral | null;
}

export interface MidConversationSystemBlockParam {
    content: Array<TextBlockParam>;
    type: "mid_conv_system";
    cache_control?: CacheControlEphemeral | null;
}

export type ContentBlockParam =
    | TextBlockParam
    | ImageBlockParam
    | DocumentBlockParam
    | SearchResultBlockParam
    | ThinkingBlockParam
    | RedactedThinkingBlockParam
    | ToolUseBlockParam
    | ToolResultBlockParam
    | ServerToolUseBlockParam
    | WebSearchToolResultBlockParam
    | WebFetchToolResultBlockParam
    | CodeExecutionToolResultBlockParam
    | BashCodeExecutionToolResultBlockParam
    | TextEditorCodeExecutionToolResultBlockParam;

export interface Messages {
    role: "user" | "assistant" | "system";
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
    ttl: "5m" | "1h";
}

export interface ToolChoiceAuto {
    type: "auto";
    disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceAny {
    type: "any";
    disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceTool {
    type: "tool";
    name: string;
    disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceNone {
    type: "none";
}

export type ToolChoice =
    ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool | ToolChoiceNone;

export type ThinkingConfigEnabled_display = "summarized" | "omitted";

export interface ThinkingConfigEnabled {
    type: "enabled";
    budget_tokens: number;
    display?: ThinkingConfigEnabled_display;
}

export interface ThinkingConfigDisabled {
    type: "disabled";
}

export interface ThinkingConfigAdaptive {
    type: "adaptive";
    display: ThinkingConfigEnabled_display;
}

export type ThinkingConfigParam =
    ThinkingConfigEnabled | ThinkingConfigDisabled | ThinkingConfigAdaptive;

export interface InputSchema {
    type: "object";
    properties?: Record<string, unknown> | null;
    required?: Array<string> | null;
}

export interface Tool {
    input_schema: InputSchema;
    name: string;
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    description?: string;
    eager_input_streaming?: boolean | null;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
    type?: "custom" | null;
}

export interface ToolBash20250124 {
    name: "bash";
    type: "bash_20250124";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
}

export interface CodeExecutionTool20250522 {
    name: "code_execution";
    type: "code_execution_20250522";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export interface CodeExecutionTool20250825 {
    name: "code_execution";
    type: "code_execution_20250825";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export interface CodeExecutionTool20260120 {
    name: "code_execution";
    type: "code_execution_20260120";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export interface CodeExecutionTool20260521 {
    name: "code_execution";
    type: "code_execution_20260521";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export interface MemoryTool20250818 {
    name: "memory";

    type: "memory_20250818";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
}

export interface ToolTextEditor20250124 {
    name: "str_replace_editor";
    type: "text_editor_20250124";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
}

export interface ToolTextEditor20250429 {
    name: "str_replace_based_edit_tool";
    type: "text_editor_20250429";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<Record<string, unknown>>;
    strict?: boolean;
}

export interface ToolTextEditor20250728 {
    name: "str_replace_based_edit_tool";
    type: "text_editor_20250728";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<Record<string, unknown>>;
    max_characters?: number | null;
    strict?: boolean;
}

export interface UserLocation {
    type: "approximate";
    city?: string | null;
    country?: string | null;
    region?: string | null;
    timezone?: string | null;
}

export interface WebSearchTool20250305 {
    name: "web_search";
    type: "web_search_20250305";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    max_uses?: number | null;
    strict?: boolean;
    user_location?: UserLocation | null;
}

export interface WebFetchTool20250910 {
    name: "web_fetch";
    type: "web_fetch_20250910";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
    defer_loading?: boolean;
    max_content_tokens?: number | null;
    max_uses?: number | null;
    strict?: boolean;
}

export interface WebSearchTool20260209 {
    name: "web_search";
    type: "web_search_20260209";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    max_uses?: number | null;
    strict?: boolean;
    user_location?: UserLocation | null;
}

export interface WebFetchTool20260209 {
    name: "web_fetch";
    type: "web_fetch_20260209";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
    defer_loading?: boolean;
    max_content_tokens?: number | null;
    max_uses?: number | null;
    strict?: boolean;
}

export interface WebFetchTool20260309 {
    name: "web_fetch";
    type: "web_fetch_20260309";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
    defer_loading?: boolean;
    max_content_tokens?: number | null;
    max_uses?: number | null;
    strict?: boolean;
    use_cache?: boolean;
}

export interface WebSearchTool20260318 {
    name: "web_search";
    type: "web_search_20260318";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    max_uses?: number | null;
    response_inclusion?: "full" | "excluded";
    strict?: boolean;
    user_location?: UserLocation | null;
}

export interface WebFetchTool20260318 {
    name: "web_fetch";
    type: "web_fetch_20260318";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    cache_control?: CacheControlEphemeral | null;
    citations?: CitationsConfigParam | null;
    defer_loading?: boolean;
    max_content_tokens?: number | null;
    max_uses?: number | null;
    response_inclusion?: "full" | "excluded";
    use_cache?: boolean;
}

export interface ToolSearchToolBm25_20251119 {
    name: "tool_search_tool_bm25";
    type: "tool_search_tool_bm25_20251119" | "tool_search_tool_bm25";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export interface ToolSearchToolRegex20251119 {
    name: "tool_search_tool_regex";
    type: "tool_search_tool_regex_20251119" | "tool_search_tool_regex";
    allowed_callers?: Array<
        | "direct"
        | "code_execution_20250825"
        | "code_execution_20260120"
        | "code_execution_20260521"
    >;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
}

export type AnthropicToolUnion =
    | Tool
    | ToolBash20250124
    | CodeExecutionTool20250522
    | CodeExecutionTool20250825
    | CodeExecutionTool20260120
    | CodeExecutionTool20260521
    | MemoryTool20250818
    | ToolTextEditor20250124
    | ToolTextEditor20250429
    | ToolTextEditor20250728
    | WebSearchTool20250305
    | WebFetchTool20250910
    | WebSearchTool20260209
    | WebFetchTool20260209
    | WebFetchTool20260309
    | WebSearchTool20260318
    | WebFetchTool20260318
    | ToolSearchToolBm25_20251119
    | ToolSearchToolRegex20251119;

export interface MessageCreateParamsBase {
    max_tokens: number;
    messages: Messages[];
    model: Modelo;
    cache_control?: CacheControlEphemeral | null;
    inference_geo?: string | null;
    container?: string | null;
    metadata?: {
        user_id?: string | null;
    };
    output_config?: FormatResponse;
    service_tier?: "auto" | "standard_only";
    stop_sequences?: string[];
    stream?: boolean;
    system?: string | TextBlockParam[];
    thinking?: ThinkingConfigParam;
    tool_choice?: ToolChoice;
    tools?: AnthropicToolUnion[];

    user_profile_id?: string;
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
