import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/logger';
import { FlowNode, FlowEdge, FlowGraph } from '../dto/config.dto';
import { AstParserException } from '../exceptions/exceptions';
import {
  FLOW_STEP_DECORATOR_NAME,
  NEXTJS_HTTP_METHODS,
  NEXTJS_PAGES_HANDLER_NAME,
  SUPPORTED_EXTENSIONS,
  EXCLUDED_DIRS,
} from '../constants';

const LOGGER_CONTEXT = 'AstParserService';

interface ParsedMethod {
  /** Display name (function name or class#method). */
  methodName: string;
  flowStepTag?: string;
  httpMethod?: string;
  routePath?: string;
  docstring?: string;
  rawBody: string;
  filePath: string;
  lineNumber: number;
  calls: string[];
  nodeType: 'controller' | 'service' | 'utility' | 'unknown';
}

export class AstParserService {
  parse(sourceRoot: string): FlowGraph {
    FlowLogger.info(LOGGER_CONTEXT, 'Starting AST parse', { sourceRoot });

    const files = this.collectSourceFiles(sourceRoot);
    FlowLogger.info(LOGGER_CONTEXT, `Found ${files.length} source files to analyze`);

    const allMethods: ParsedMethod[] = [];
    for (const file of files) {
      try {
        const methods = this.parseFile(file);
        allMethods.push(...methods);
      } catch (err) {
        FlowLogger.warn(LOGGER_CONTEXT, 'Skipping file due to parse error', {
          file,
          error: (err as Error).message,
        });
      }
    }

    const graph = this.buildGraph(allMethods);
    FlowLogger.info(LOGGER_CONTEXT, 'AST parse complete', {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    });
    return graph;
  }

  private collectSourceFiles(root: string): string[] {
    const results: string[] = [];

    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    };

    walk(root);
    return results;
  }

  private parseFile(filePath: string): ParsedMethod[] {
    const source = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

    const methods: ParsedMethod[] = [];

    // Parse class-based methods (e.g., service classes)
    const visitClasses = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        methods.push(...this.parseClass(node, sourceFile, filePath));
      }
      ts.forEachChild(node, visitClasses);
    };
    ts.forEachChild(sourceFile, visitClasses);

    // Parse top-level exported functions (Next.js route handlers and utility functions)
    methods.push(...this.parseTopLevelFunctions(sourceFile, filePath));

    return methods;
  }

  // ─── Class-based parsing (service classes) ────────────────────────────────

  private parseClass(
    classNode: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): ParsedMethod[] {
    const className = classNode.name?.getText(sourceFile) ?? 'AnonymousClass';
    const methods: ParsedMethod[] = [];

    for (const member of classNode.members) {
      if (!ts.isMethodDeclaration(member)) continue;

      const methodName = member.name ? `${className}#${member.name.getText(sourceFile)}` : `${className}#anonymous`;
      const flowStepTag = this.extractFlowStepTagFromDecorators(member, sourceFile);
      const docstring = this.extractJsDoc(member, sourceFile);
      const rawBody = member.body ? member.body.getText(sourceFile) : '';
      const lineNumber = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1;
      const calls = member.body ? this.extractCallExpressions(member.body, sourceFile) : [];

      methods.push({
        methodName,
        flowStepTag,
        docstring,
        rawBody,
        filePath,
        lineNumber,
        calls,
        nodeType: 'service',
      });
    }

    return methods;
  }

  // ─── Top-level function parsing (Next.js route handlers) ──────────────────

  private parseTopLevelFunctions(sourceFile: ts.SourceFile, filePath: string): ParsedMethod[] {
    const methods: ParsedMethod[] = [];
    const isRouteFile = this.isNextJsRouteFile(filePath);
    const isPagesApiFile = this.isPagesApiFile(filePath);

    ts.forEachChild(sourceFile, (node) => {
      // export async function GET(...) { ... }
      // export async function POST(...) { ... }
      if (ts.isFunctionDeclaration(node) && this.hasExportModifier(node) && node.name) {
        const fnName = node.name.getText(sourceFile);
        const method = this.parseFunctionNode(fnName, node.body, node, sourceFile, filePath, isRouteFile, isPagesApiFile);
        if (method) methods.push(method);
      }

      // export default async function handler(...) { ... }
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        const expr = node.expression;
        if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) {
          const fnName = (expr as ts.FunctionExpression).name?.getText(sourceFile) ?? NEXTJS_PAGES_HANDLER_NAME;
          const method = this.parseFunctionNode(fnName, expr.body as ts.Block, expr, sourceFile, filePath, isRouteFile, isPagesApiFile);
          if (method) methods.push(method);
        }
      }

      // export const GET = async (req: NextRequest) => { ... }
      // export const handler = async (req, res) => { ... }
      if (ts.isVariableStatement(node) && this.hasExportModifier(node)) {
        for (const decl of node.declarationList.declarations) {
          if (!decl.name || !ts.isIdentifier(decl.name)) continue;
          const fnName = decl.name.getText(sourceFile);
          if (!decl.initializer) continue;

          const init = decl.initializer;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            const method = this.parseFunctionNode(fnName, init.body as ts.Block, init, sourceFile, filePath, isRouteFile, isPagesApiFile);
            if (method) methods.push(method);
          }
        }
      }
    });

    return methods;
  }

  private parseFunctionNode(
    fnName: string,
    body: ts.Block | ts.Expression | undefined,
    node: ts.Node,
    sourceFile: ts.SourceFile,
    filePath: string,
    isRouteFile: boolean,
    isPagesApiFile: boolean,
  ): ParsedMethod | null {
    if (!body || !ts.isBlock(body)) return null;

    const isHttpHandler = NEXTJS_HTTP_METHODS.includes(fnName.toUpperCase());
    const isPagesHandler = isPagesApiFile && fnName === NEXTJS_PAGES_HANDLER_NAME;
    const isController = (isRouteFile && isHttpHandler) || isPagesHandler;

    const flowStepTag = this.extractFlowStepTagFromJsDoc(node, sourceFile)
      ?? this.extractFlowStepTagFromDecorators(node, sourceFile);
    const docstring = this.extractJsDoc(node, sourceFile);
    const rawBody = body.getText(sourceFile);
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const calls = this.extractCallExpressions(body, sourceFile);

    const routePath = isController ? this.deriveRoutePath(filePath, fnName) : undefined;
    const httpMethod = isHttpHandler ? fnName.toUpperCase() : (isPagesHandler ? 'ALL' : undefined);

    return {
      methodName: fnName,
      flowStepTag,
      httpMethod,
      routePath,
      docstring,
      rawBody,
      filePath,
      lineNumber,
      calls,
      nodeType: isController ? 'controller' : 'service',
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isNextJsRouteFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    // App Router: .../app/**/route.[jt]s[x]?
    return /\/app\/.*\/route\.[jt]sx?$/.test(normalized);
  }

  private isPagesApiFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    // Pages Router: .../pages/api/**/*.[jt]s[x]?
    return /\/pages\/api\/.*\.[jt]sx?$/.test(normalized);
  }

  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers) return false;
    return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  private extractFlowStepTagFromDecorators(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    if (!ts.canHaveDecorators(node)) return undefined;
    const decorators = ts.getDecorators(node as ts.HasDecorators);
    if (!decorators) return undefined;

    for (const d of decorators) {
      if (!ts.isCallExpression(d.expression)) continue;
      const name = d.expression.expression.getText(sourceFile);
      if (name !== FLOW_STEP_DECORATOR_NAME) continue;
      if (d.expression.arguments.length === 0) continue;
      const arg = d.expression.arguments[0];
      if (ts.isStringLiteral(arg)) return arg.text;
    }

    return undefined;
  }

  /**
   * Reads @flow-step tags from JSDoc comments.
   *
   * @example
   * // @flow-step Validate request and authenticate user
   * export async function POST(request: NextRequest) { ... }
   */
  private extractFlowStepTagFromJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    const jsDocNodes = (node as any).jsDoc as ts.JSDoc[] | undefined;
    if (!jsDocNodes) return undefined;

    for (const doc of jsDocNodes) {
      if (!doc.tags) continue;
      for (const tag of doc.tags) {
        const tagName = tag.tagName.getText(sourceFile);
        if (tagName === 'flow-step' && tag.comment) {
          const comment = typeof tag.comment === 'string' ? tag.comment : tag.comment.map((c: any) => c.text ?? c.getText(sourceFile)).join('');
          return comment.trim();
        }
      }
    }

    return undefined;
  }

  private extractJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    const jsDocNodes = (node as any).jsDoc as ts.JSDoc[] | undefined;
    if (!jsDocNodes || jsDocNodes.length === 0) return undefined;

    const parts = jsDocNodes.map((doc) => {
      if (typeof doc.comment === 'string') return doc.comment;
      if (Array.isArray(doc.comment)) {
        return doc.comment.map((c: any) => (typeof c === 'string' ? c : c.getText(sourceFile))).join('');
      }
      return '';
    });

    return parts.join('\n').trim() || undefined;
  }

  private extractCallExpressions(body: ts.Block, sourceFile: ts.SourceFile): string[] {
    const calls = new Set<string>();

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        if (ts.isPropertyAccessExpression(node.expression)) {
          calls.add(node.expression.name.getText(sourceFile));
        } else if (ts.isIdentifier(node.expression)) {
          calls.add(node.expression.getText(sourceFile));
        }
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(body, visit);
    return [...calls];
  }

  /**
   * Derives a human-readable route path from the file path.
   *
   * app/api/users/[id]/route.ts  + GET  → GET /api/users/[id]
   * pages/api/users/index.ts     + ALL  → ALL /api/users
   */
  private deriveRoutePath(filePath: string, httpMethod: string): string {
    const normalized = filePath.replace(/\\/g, '/');

    // App Router
    const appMatch = normalized.match(/\/app(\/.*?)\/route\.[jt]sx?$/);
    if (appMatch) {
      return appMatch[1] || '/';
    }

    // Pages Router
    const pagesMatch = normalized.match(/\/pages(\/api\/.*?)\.[jt]sx?$/);
    if (pagesMatch) {
      return pagesMatch[1].replace(/\/index$/, '') || '/';
    }

    return `/${httpMethod.toLowerCase()}`;
  }

  // ─── Graph construction ───────────────────────────────────────────────────

  private buildGraph(methods: ParsedMethod[]): FlowGraph {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const methodIndex = new Map<string, string>();

    for (const method of methods) {
      const nodeId = `${method.filePath}:${method.methodName}:${method.lineNumber}`;
      methodIndex.set(method.methodName, nodeId);
      // Also index by bare method name (e.g. "create" for "OrdersService#create")
      // so that call expressions like `this.ordersService.create(...)` resolve correctly.
      const bareName = method.methodName.includes('#') ? method.methodName.split('#')[1] : null;
      if (bareName) methodIndex.set(bareName, nodeId);

      nodes.push({
        id: nodeId,
        label: method.flowStepTag ?? method.methodName,
        methodName: method.methodName,
        type: method.nodeType,
        filePath: method.filePath,
        lineNumber: method.lineNumber,
        docstring: method.docstring,
        rawBody: method.rawBody,
        customTag: method.flowStepTag,
        httpMethod: method.httpMethod,
        routePath: method.routePath,
      });
    }

    for (const method of methods) {
      const fromId = `${method.filePath}:${method.methodName}:${method.lineNumber}`;

      for (let i = 0; i < method.calls.length; i++) {
        const toId = methodIndex.get(method.calls[i]);
        if (toId && toId !== fromId) {
          edges.push({ from: fromId, to: toId, callOrder: i });
        }
      }
    }

    return {
      nodes,
      edges: this.deduplicateEdges(edges),
      generatedAt: new Date().toISOString(),
    };
  }

  private deduplicateEdges(edges: FlowEdge[]): FlowEdge[] {
    const seen = new Set<string>();
    return edges.filter((e) => {
      const key = `${e.from}→${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
