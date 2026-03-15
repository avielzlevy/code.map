import * as path from 'path';

import { AstParserService } from '../ast-parser.service';

const FIXTURE_DIR = path.resolve(__dirname, '../../../test/fixtures');

describe('AstParserService', () => {
  let parser: AstParserService;

  beforeEach(() => {
    parser = new AstParserService();
  });

  describe('parse()', () => {
    it('returns a graph with nodes and a generatedAt timestamp', () => {
      const graph = parser.parse(FIXTURE_DIR);

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.generatedAt).toBeTruthy();
    });

    it('classifies @Controller methods as type "controller"', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const controllerNodes = graph.nodes.filter((n) => n.type === 'controller');

      expect(controllerNodes.length).toBeGreaterThan(0);
    });

    it('classifies @Injectable methods as type "service"', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const serviceNodes = graph.nodes.filter((n) => n.type === 'service');

      expect(serviceNodes.length).toBeGreaterThan(0);
    });

    it('uses the @FlowStep description as the node label', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const node = graph.nodes.find((n) => n.label === 'Fetch all active users with pagination');

      expect(node).toBeDefined();
      expect(node!.customTag).toBe('Fetch all active users with pagination');
    });

    it('falls back to the method name as label when no @FlowStep is present', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const node = graph.nodes.find((n) => n.label === 'create');

      expect(node).toBeDefined();
    });

    it('extracts the JSDoc comment as docstring', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const node = graph.nodes.find((n) => n.label === 'Fetch all active users with pagination');

      expect(node!.docstring).toContain('paginated list of active users');
    });

    it('captures the raw method body', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const node = graph.nodes.find((n) => n.label === 'Fetch all active users with pagination');

      expect(node!.rawBody).toContain('userService');
    });

    it('records the correct line number for each method', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const node = graph.nodes.find((n) => n.label === 'Fetch all active users with pagination');

      expect(node!.lineNumber).toBeGreaterThan(0);
    });

    it('builds call edges between methods in the same project', () => {
      const graph = parser.parse(FIXTURE_DIR);

      // UserController.findAll calls UserService.findAll → edge must exist
      const fromLabel = 'Fetch all active users with pagination';
      const fromNode = graph.nodes.find((n) => n.label === fromLabel);
      expect(fromNode).toBeDefined();

      const outgoingEdges = graph.edges.filter((e) => e.from === fromNode!.id);
      expect(outgoingEdges.length).toBeGreaterThan(0);
    });

    it('deduplicates edges that appear more than once', () => {
      const graph = parser.parse(FIXTURE_DIR);
      const edgeKeys = graph.edges.map((e) => `${e.from}→${e.to}`);
      const uniqueKeys = new Set(edgeKeys);

      expect(edgeKeys.length).toBe(uniqueKeys.size);
    });

    it('skips non-TypeScript files silently', () => {
      // Parsing a dir with only fixtures should not throw
      expect(() => parser.parse(FIXTURE_DIR)).not.toThrow();
    });
  });
});
