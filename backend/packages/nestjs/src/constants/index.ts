export const DEFAULT_SIDECAR_PORT = 4567;
export const FLOW_CACHE_DIR = '.flow-cache';
export const FLOW_CACHE_INDEX_FILE = 'index.json';
export const FLOW_STEP_DECORATOR_NAME = 'FlowStep';
export const SIDECAR_API_PREFIX = '/api/flow-map';

export const NANO_AGENT_MAX_TOKENS = 50;
export const NANO_AGENT_BATCH_SIZE = 5; // concurrent requests per batch — tune per provider
export const NANO_AGENT_ALL_FAILED_THRESHOLD = 1.0; // 100% failure rate triggers config error log
export const NANO_AGENT_MAX_RETRIES = 3;
export const NANO_AGENT_RETRY_BASE_MS = 500; // doubles each attempt: 500 → 1000 → 2000ms

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter';

export const PROVIDER_CONFIGS: Record<
  AIProvider,
  { apiUrl: string; defaultModel: string; anthropicVersion?: string }
> = {
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-haiku-4-5-20251001',
    anthropicVersion: '2023-06-01',
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  gemini: {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.0-flash',
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'google/gemini-2.0-flash-001',
  },
};

export const NANO_AGENT_PROMPT_TEMPLATE =
  'You are a Nano-Agent analyzing source code. Provide a strict, concise (10-15 words max) ' +
  'summary of the technical transformation occurring here. Do not describe execution steps or ' +
  'write code blocks. Focus on business intent.\n\n' +
  'Function code:\n```\n{CODE}\n```\n\n' +
  '{DOCSTRING_SECTION}' +
  '{CUSTOM_TAG_SECTION}' +
  'Summary:';

export const NESTJS_CONTROLLER_DECORATORS = ['Controller'];
export const NESTJS_INJECTABLE_DECORATORS = ['Injectable'];
export const NESTJS_HTTP_METHOD_DECORATORS = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'];

export const HTTP_METHOD_MAP: Record<string, string> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Delete: 'DELETE',
  Patch: 'PATCH',
  Options: 'OPTIONS',
  Head: 'HEAD',
};

export const SUPPORTED_EXTENSIONS = ['.ts', '.js'];
export const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', 'coverage', '__tests__'];

/** Maximum depth of the ordered DFS when building execution paths. */
export const MAX_EXECUTION_DEPTH = 4;

/** How many levels deep each drill-down detail layer expands.
 *  1 = only direct children of the clicked node — true progressive disclosure. */
export const DETAIL_EXPANSION_DEPTH = 1;

/** Milliseconds of quiet-time after the last file change before triggering a rebuild. */
export const FILE_WATCHER_DEBOUNCE_MS = 500;

/** Milliseconds between SSE keep-alive heartbeat comments (prevents proxy timeouts). */
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
