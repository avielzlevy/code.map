DEFAULT_SIDECAR_PORT: int = 4567
FLOW_CACHE_DIR: str = ".flow-cache"
FLOW_CACHE_INDEX_FILE: str = "index.json"
FLOW_STEP_ATTR: str = "_flow_step_description"
SIDECAR_API_PREFIX: str = "/api/flow-map"

NANO_AGENT_MAX_TOKENS: int = 50

from typing import Literal

AIProvider = Literal["anthropic", "openai", "gemini", "openrouter"]

PROVIDER_CONFIGS: dict[str, dict[str, str]] = {
    "anthropic": {
        "api_url": "https://api.anthropic.com/v1/messages",
        "default_model": "claude-haiku-4-5-20251001",
        "anthropic_version": "2023-06-01",
    },
    "openai": {
        "api_url": "https://api.openai.com/v1/chat/completions",
        "default_model": "gpt-4o-mini",
    },
    "gemini": {
        "api_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "default_model": "gemini-2.0-flash",
    },
    "openrouter": {
        "api_url": "https://openrouter.ai/api/v1/chat/completions",
        "default_model": "google/gemini-2.0-flash-001",
    },
}

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
