DEFAULT_SIDECAR_PORT: int = 4567
FLOW_CACHE_DIR: str = ".flow-cache"
FLOW_CACHE_INDEX_FILE: str = "index.json"
FLOW_STEP_ATTR: str = "_flow_step_description"
SIDECAR_API_PREFIX: str = "/api/flow-map"

NANO_AGENT_MODEL: str = "claude-haiku-4-5-20251001"
NANO_AGENT_MAX_TOKENS: int = 50
NANO_AGENT_API_URL: str = "https://api.anthropic.com/v1/messages"
NANO_AGENT_ANTHROPIC_VERSION: str = "2023-06-01"

NANO_AGENT_PROMPT_TEMPLATE: str = (
    "You are a Nano-Agent analyzing source code. Provide a strict, concise (10-15 words max) "
    "summary of the technical transformation occurring here. Do not describe execution steps or "
    "write code blocks. Focus on business intent.\n\n"
    "Function code:\n```\n{code}\n```\n\n"
    "{docstring_section}"
    "{custom_tag_section}"
    "Summary:"
)

FASTAPI_ROUTE_DECORATORS: frozenset[str] = frozenset(
    {"get", "post", "put", "delete", "patch", "options", "head", "route", "api_route"}
)
EXCLUDED_DIRS: frozenset[str] = frozenset(
    {"__pycache__", ".git", "node_modules", ".venv", "venv", "dist", "build", ".pytest_cache", "spec"}
)
SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".py"})
