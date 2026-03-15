import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import { FlowNode, FlowEdge, FlowGraph } from '../dto/flow-mapper-config.dto';
import { AstParserException } from '../exceptions/flow-mapper.exceptions';
import {
  NESTJS_CONTROLLER_DECORATORS,
  NESTJS_INJECTABLE_DECORATORS,
  FLOW_STEP_DECORATOR_NAME,
  HTTP_METHOD_MAP,
  SUPPORTED_EXTENSIONS,
  EXCLUDED_DIRS,
} from '../constants';

const LOGGER_CONTEXT = 'AstParserService';

interface ParsedMethod {
  className: string;
  methodName: string;
  classDecorators: string[];
  methodDecorators: string[];
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

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        const classMethods = this.parseClass(node, sourceFile, filePath);
        methods.push(...classMethods);
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return methods;
  }

  private parseClass(
    classNode: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): ParsedMethod[] {
    const className = classNode.name?.getText(sourceFile) ?? 'AnonymousClass';
    const classDecorators = this.extractDecoratorNames(classNode, sourceFile);
    const nodeType = this.classifyNodeType(classDecorators);
    const methods: ParsedMethod[] = [];

    for (const member of classNode.members) {
      if (!ts.isMethodDeclaration(member)) continue;

      const methodName = member.name ? member.name.getText(sourceFile) : 'anonymous';
      const methodDecorators = this.extractDecoratorNames(member, sourceFile);
      const flowStepTag = this.extractFlowStepTag(member, sourceFile);
      const { httpMethod, routePath } = this.extractHttpDecorator(member, sourceFile);
      const docstring = this.extractJsDoc(member, sourceFile);
      const rawBody = member.body ? member.body.getText(sourceFile) : '';
      const lineNumber = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1;
      const calls = member.body ? this.extractCallExpressions(member.body, sourceFile) : [];

      methods.push({
        className,
        methodName,
        classDecorators,
        methodDecorators,
        flowStepTag,
        httpMethod,
        routePath,
        docstring,
        rawBody,
        filePath,
        lineNumber,
        calls,
        nodeType,
      });
    }

    return methods;
  }

  private extractDecoratorNames(node: ts.Node, sourceFile: ts.SourceFile): string[] {
    if (!ts.canHaveDecorators(node)) return [];

    const decorators = ts.getDecorators(node as ts.HasDecorators);
    if (!decorators) return [];

    return decorators.map((d) => {
      if (ts.isCallExpression(d.expression)) {
        return d.expression.expression.getText(sourceFile);
      }
      return d.expression.getText(sourceFile);
    });
  }

  private extractFlowStepTag(method: ts.MethodDeclaration, sourceFile: ts.SourceFile): string | undefined {
    if (!ts.canHaveDecorators(method)) return undefined;

    const decorators = ts.getDecorators(method);
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

  private extractJsDoc(method: ts.MethodDeclaration, sourceFile: ts.SourceFile): string | undefined {
    const jsDocNodes = (method as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc;
    if (!jsDocNodes || jsDocNodes.length === 0) return undefined;

    const parts = jsDocNodes.map((doc) => {
      if (typeof doc.comment === 'string') return doc.comment;
      if (Array.isArray(doc.comment)) {
        return doc.comment
          .map((c) => (typeof c === 'string' ? c : c.getText(sourceFile)))
          .join('');
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

  private extractHttpDecorator(
    method: ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
  ): { httpMethod?: string; routePath?: string } {
    if (!ts.canHaveDecorators(method)) return {};

    const decorators = ts.getDecorators(method);
    if (!decorators) return {};

    for (const d of decorators) {
      if (!ts.isCallExpression(d.expression)) continue;
      const name = d.expression.expression.getText(sourceFile);
      const httpMethod = HTTP_METHOD_MAP[name];
      if (!httpMethod) continue;

      const firstArg = d.expression.arguments[0];
      const routePath =
        firstArg && ts.isStringLiteral(firstArg) ? firstArg.text : '';
      return { httpMethod, routePath };
    }

    return {};
  }

  private classifyNodeType(decorators: string[]): 'controller' | 'service' | 'utility' | 'unknown' {
    if (decorators.some((d) => NESTJS_CONTROLLER_DECORATORS.includes(d))) return 'controller';
    if (decorators.some((d) => NESTJS_INJECTABLE_DECORATORS.includes(d))) return 'service';
    return 'utility';
  }

  private buildGraph(methods: ParsedMethod[]): FlowGraph {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const methodIndex = new Map<string, string>();

    for (const method of methods) {
      const nodeId = `${method.filePath}:${method.className}#${method.methodName}:${method.lineNumber}`;
      methodIndex.set(method.methodName, nodeId);

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
      const fromId = `${method.filePath}:${method.className}#${method.methodName}:${method.lineNumber}`;

      for (const call of method.calls) {
        const toId = methodIndex.get(call);
        if (toId && toId !== fromId) {
          edges.push({ from: fromId, to: toId });
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
