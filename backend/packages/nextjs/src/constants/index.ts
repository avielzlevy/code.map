export const DEFAULT_SIDECAR_PORT = 4567;
export const FLOW_CACHE_DIR = '.flow-cache';
export const FLOW_CACHE_INDEX_FILE = 'index.json';
export const FLOW_STEP_DECORATOR_NAME = 'FlowStep';
export const SIDECAR_API_PREFIX = '/api/flow-map';

export const NANO_AGENT_MODEL = 'claude-haiku-4-5-20251001';
export const NANO_AGENT_MAX_TOKENS = 50;
export const NANO_AGENT_API_URL = 'https://api.anthropic.com/v1/messages';
export const NANO_AGENT_ANTHROPIC_VERSION = '2023-06-01';

export const NANO_AGENT_PROMPT_TEMPLATE =
  'You are a Nano-Agent analyzing source code. Provide a strict, concise (10-15 words max) ' +
  'summary of the technical transformation occurring here. Do not describe execution steps or ' +
  'write code blocks. Focus on business intent.\n\n' +
  'Function code:\n```\n{CODE}\n```\n\n' +
  '{DOCSTRING_SECTION}' +
  '{CUSTOM_TAG_SECTION}' +
  'Summary:';

/** Next.js App Router: exported HTTP method handlers in route files. */
export const NEXTJS_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/** Next.js Pages Router: default export handler name. */
export const NEXTJS_PAGES_HANDLER_NAME = 'handler';

export const HTTP_METHOD_MAP: Record<string, string> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};

export const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
export const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', '.git', 'coverage', '__tests__', 'out'];

/** Maximum depth of the ordered DFS when building execution paths. */
export const MAX_EXECUTION_DEPTH = 4;

/** How many levels deep each drill-down detail layer expands.
 *  1 = only direct children of the clicked node — true progressive disclosure. */
export const DETAIL_EXPANSION_DEPTH = 1;
