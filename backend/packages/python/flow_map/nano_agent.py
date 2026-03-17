from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx

from .constants import (
    NANO_AGENT_MAX_TOKENS,
    NANO_AGENT_PROMPT_TEMPLATE,
    PROVIDER_CONFIGS,
)
from .exceptions import NanoAgentError
from .logger import FlowLogger

if TYPE_CHECKING:
    from .ast_parser import FlowNode

LOGGER_CONTEXT = "NanoAgentService"


class NanoAgentService:
    def __init__(self, api_key: str, provider: str = "anthropic") -> None:
        self._api_key = api_key
        self._provider = provider

    async def summarize(self, node: FlowNode) -> str:
        prompt = self._build_prompt(node)
        FlowLogger.debug(LOGGER_CONTEXT, "Requesting AI summary", {"node_id": node.id, "provider": self._provider})

        url, body, headers = self._build_request(prompt)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=body, headers=headers)
                response.raise_for_status()

                summary = self._parse_response(response.json())
                FlowLogger.debug(
                    LOGGER_CONTEXT,
                    "Received AI summary",
                    {"node_id": node.id, "summary": summary},
                )
                return summary

        except httpx.HTTPStatusError as err:
            raise NanoAgentError(
                node.id, f"HTTP {err.response.status_code}: {err.response.text}"
            )
        except Exception as err:
            raise NanoAgentError(node.id, str(err))

    def _build_request(self, prompt: str) -> tuple[str, dict[str, Any], dict[str, str]]:
        config = PROVIDER_CONFIGS[self._provider]

        if self._provider == "anthropic":
            return (
                config["api_url"],
                {"model": config["default_model"], "max_tokens": NANO_AGENT_MAX_TOKENS, "messages": [{"role": "user", "content": prompt}]},
                {"x-api-key": self._api_key, "anthropic-version": config["anthropic_version"], "content-type": "application/json"},
            )

        if self._provider == "gemini":
            url = f"{config['api_url']}/{config['default_model']}:generateContent?key={self._api_key}"
            return (
                url,
                {"contents": [{"parts": [{"text": prompt}]}]},
                {"content-type": "application/json"},
            )

        # openai and openrouter share the OpenAI-compatible format
        return (
            config["api_url"],
            {"model": config["default_model"], "max_tokens": NANO_AGENT_MAX_TOKENS, "messages": [{"role": "user", "content": prompt}]},
            {"Authorization": f"Bearer {self._api_key}", "content-type": "application/json"},
        )

    def _parse_response(self, data: dict[str, Any]) -> str:
        if self._provider == "anthropic":
            return (data.get("content", [{}])[0].get("text", "")).strip()
        if self._provider == "gemini":
            candidates = data.get("candidates", [{}])
            parts = candidates[0].get("content", {}).get("parts", [{}])
            return parts[0].get("text", "").strip()
        # openai and openrouter
        return (data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()

    def _build_prompt(self, node: FlowNode) -> str:
        docstring_section = f"Docstring:\n{node.docstring}\n\n" if node.docstring else ""
        custom_tag_section = (
            f'Business intent tag: "{node.custom_tag}"\n\n' if node.custom_tag else ""
        )
        return (
            NANO_AGENT_PROMPT_TEMPLATE
            .replace("{code}", node.raw_body)
            .replace("{docstring_section}", docstring_section)
            .replace("{custom_tag_section}", custom_tag_section)
        )
