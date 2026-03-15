import os
import pytest

from flow_map.ast_parser import AstParserService

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "../../test/fixtures")


@pytest.fixture
def parser() -> AstParserService:
    return AstParserService()


@pytest.fixture
def graph(parser: AstParserService):
    return parser.parse(FIXTURE_DIR)


class TestAstParserParse:
    def test_returns_nodes_and_timestamp(self, graph):
        assert len(graph.nodes) > 0
        assert graph.generated_at != ""

    def test_uses_flow_step_description_as_label(self, graph):
        node = next(
            (n for n in graph.nodes if n.label == "Fetch all active users with pagination"),
            None,
        )
        assert node is not None
        assert node.custom_tag == "Fetch all active users with pagination"

    def test_falls_back_to_method_name_when_no_tag(self, graph):
        node = next((n for n in graph.nodes if n.label == "create"), None)
        assert node is not None

    def test_extracts_docstring(self, graph):
        node = next(
            (n for n in graph.nodes if n.label == "Fetch all active users with pagination"),
            None,
        )
        assert node is not None
        assert "paginated list" in (node.docstring or "")

    def test_captures_raw_body(self, graph):
        node = next(
            (n for n in graph.nodes if n.label == "Fetch all active users with pagination"),
            None,
        )
        assert node is not None
        assert "user_service" in node.raw_body

    def test_records_line_number(self, graph):
        node = next(
            (n for n in graph.nodes if n.label == "Fetch all active users with pagination"),
            None,
        )
        assert node is not None
        assert node.line_number > 0

    def test_builds_call_edges(self, graph):
        from_node = next(
            (n for n in graph.nodes if n.label == "Fetch all active users with pagination"),
            None,
        )
        assert from_node is not None

        outgoing = [e for e in graph.edges if e.from_id == from_node.id]
        assert len(outgoing) > 0

    def test_deduplicates_edges(self, graph):
        edge_keys = [f"{e.from_id}→{e.to_id}" for e in graph.edges]
        assert len(edge_keys) == len(set(edge_keys))

    def test_does_not_raise_on_valid_directory(self, parser):
        # Should parse gracefully without exceptions
        graph = parser.parse(FIXTURE_DIR)
        assert graph is not None
