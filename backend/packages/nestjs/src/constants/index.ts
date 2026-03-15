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
