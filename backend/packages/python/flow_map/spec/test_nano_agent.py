import pytest
import httpx
import respx  # pip install respx  (httpx mock library)

from flow_map.ast_parser import FlowNode
from flow_map.nano_agent import NanoAgentService
from flow_map.exceptions import NanoAgentError


def make_node(**overrides) -> FlowNode:
    defaults = dict(
        id="src/user_service.py:UserService#create:10",
        label="create",
        method_name="create",
        type="service",
        file_path="src/user_service.py",
        line_number=10,
        raw_body="async def create(self): return await self.db.save(user)",
        docstring="Creates a new user record.",
        custom_tag="Persist new user to database",
    )
    return FlowNode(**{**defaults, **overrides})


@pytest.fixture
def service() -> NanoAgentService:
    return NanoAgentService(api_key="test-key")


class TestSummarize:
    @respx.mock
    @pytest.mark.asyncio
    async def test_returns_trimmed_summary(self, service: NanoAgentService):
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={"content": [{"text": "  Saves entity to persistence layer  "}]},
            )
        )

        result = await service.summarize(make_node())
        assert result == "Saves entity to persistence layer"

    @respx.mock
    @pytest.mark.asyncio
    async def test_prompt_contains_raw_body(self, service: NanoAgentService):
        captured = {}

        async def capture(request: httpx.Request):
            import json as _json
            captured["body"] = _json.loads(request.content)
            return httpx.Response(200, json={"content": [{"text": "summary"}]})

        respx.post("https://api.anthropic.com/v1/messages").mock(side_effect=capture)
        await service.summarize(make_node())

        prompt = captured["body"]["messages"][0]["content"]
        assert "async def create" in prompt
        assert "Creates a new user record." in prompt
        assert "Persist new user to database" in prompt

    @respx.mock
    @pytest.mark.asyncio
    async def test_omits_docstring_section_when_none(self, service: NanoAgentService):
        captured = {}

        async def capture(request: httpx.Request):
            import json as _json
            captured["body"] = _json.loads(request.content)
            return httpx.Response(200, json={"content": [{"text": "summary"}]})

        respx.post("https://api.anthropic.com/v1/messages").mock(side_effect=capture)
        await service.summarize(make_node(docstring=None))

        prompt = captured["body"]["messages"][0]["content"]
        assert "Docstring:" not in prompt

    @respx.mock
    @pytest.mark.asyncio
    async def test_raises_nano_agent_error_on_4xx(self, service: NanoAgentService):
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(401, json={"error": {"message": "invalid_api_key"}})
        )

        with pytest.raises(NanoAgentError):
            await service.summarize(make_node())

    @respx.mock
    @pytest.mark.asyncio
    async def test_raises_nano_agent_error_on_network_failure(self, service: NanoAgentService):
        respx.post("https://api.anthropic.com/v1/messages").mock(
            side_effect=httpx.ConnectError("ECONNREFUSED")
        )

        with pytest.raises(NanoAgentError):
            await service.summarize(make_node())
