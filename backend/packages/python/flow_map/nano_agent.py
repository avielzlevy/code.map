from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from .constants import (
    NANO_AGENT_MODEL,
    NANO_AGENT_MAX_TOKENS,
    NANO_AGENT_API_URL,
    NANO_AGENT_ANTHROPIC_VERSION,
    NANO_AGENT_PROMPT_TEMPLATE,
)
from .exceptions import NanoAgentError
from .logger import FlowLogger

if TYPE_CHECKING:
    from .ast_parser import FlowNode

LOGGER_CONTEXT = "NanoAgentService"


class NanoAgentService:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def summarize(self, node: FlowNode) -> str:
        prompt = self._build_prompt(node)
        FlowLogger.debug(LOGGER_CONTEXT, "Requesting AI summary", {"node_id": node.id})

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    NANO_AGENT_API_URL,
                    json={
                        "model": NANO_AGENT_MODEL,
                        "max_tokens": NANO_AGENT_MAX_TOKENS,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    headers={
                        "x-api-key": self._api_key,
                        "anthropic-version": NANO_AGENT_ANTHROPIC_VERSION,
                        "content-type": "application/json",
                    },
                )
                response.raise_for_status()

                data = response.json()
                summary: str = (data.get("content", [{}])[0].get("text", "")).strip()
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
