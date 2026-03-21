import * as fs from 'fs';
import * as path from 'path';

// tree-sitter and its TypeScript grammar use native C bindings — require() only
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('tree-sitter') as typeof import('tree-sitter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { typescript: TSGrammar } = require('tree-sitter-typescript') as {
  typescript: unknown;
  tsx: unknown;
};

import { FlowLogger } from '../logger/flow-logger';
import { FlowNode, FlowEdge, FlowGraph } from '../dto/flow-mapper-config.dto';
import { AstParserException } from '../exceptions/flow-mapper.exceptions';
import { SUPPORTED_EXTENSIONS, EXCLUDED_DIRS } from '../constants';
import { detectFramework, FrameworkDescriptor } from './framework-detector';

// tree-sitter SyntaxNode type (the package ships its own types)
type SyntaxNode = import('tree-sitter').SyntaxNode;

const LOGGER_CONTEXT = 'AstParserService';

// ---------------------------------------------------------------------------
// Internal shapes — never leave this file
// ---------------------------------------------------------------------------

interface CallSite {
  /** Unqualified method name, e.g. `findMany` */
  method: string;
  /**
   * Object the method is called on, e.g. `deploymentService` from
   * `this.deploymentService.findMany()`. Undefined for plain calls.
   */
  object?: string;
}

interface ParsedMethod {
  className: string;
  methodName: string;
  classDecorators: string[];
  methodDecorators: string[];
  flowStepTag?: string;
  httpMethod?: string;
  routePath?: string;
  controllerPrefix?: string;
  docstring?: string;
  rawBody: string;
  filePath: string;
  lineNumber: number;
  calls: CallSite[];
  /** Constructor-injected deps: paramName → TypeName */
  constructorInjections: Map<string, string>;
  nodeType: 'controller' | 'service' | 'utility' | 'unknown';
}

// ---------------------------------------------------------------------------
// AstParserService
// ---------------------------------------------------------------------------

export class AstParserService {
  // Lazily initialised once per parse() call after detecting the framework
  private parser!: import('tree-sitter');
  private descriptor!: FrameworkDescriptor;

  parse(sourceRoot: string): FlowGraph {
    FlowLogger.info(LOGGER_CONTEXT, 'Starting AST parse (tree-sitter)', { sourceRoot });

    // Detect which framework is in use and configure the parser
    this.descriptor = detectFramework(sourceRoot);
    FlowLogger.info(LOGGER_CONTEXT, `Detected framework: ${this.descriptor.displayName}`);

    this.parser = new (Parser as any)();
    (this.parser as any).setLanguage(TSGrammar);

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

  // ---------------------------------------------------------------------------
  // File collection
  // ---------------------------------------------------------------------------

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
          if (!EXCLUDED_DIRS.includes(entry.name)) walk(fullPath);
        } else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    };

    walk(root);
    return results;
  }

  // ---------------------------------------------------------------------------
  // File → ParsedMethod[]
  // ---------------------------------------------------------------------------

  private parseFile(filePath: string): ParsedMethod[] {
    const source = fs.readFileSync(filePath, 'utf8');

    let tree: import('tree-sitter').Tree;
    try {
      // Use the streaming callback form of parse() — direct string input fails on
      // large files in some Node.js environments due to native binding limits.
      tree = (this.parser as any).parse(
        (startIndex: number, _startPoint: unknown, endIndex: number) => {
          if (startIndex >= source.length) return null;
          return source.slice(startIndex, endIndex != null ? endIndex : startIndex + 4096);
        },
      ) as import('tree-sitter').Tree;
    } catch (err) {
      throw new AstParserException(filePath, (err as Error).message);
    }

    const methods: ParsedMethod[] = [];

    // Always collect class-based nodes (services, utilities, NestJS controllers)
    this.walkNode(tree.rootNode, (node) => {
      if (node.type === 'class_declaration') {
        methods.push(...this.parseClass(node, source, filePath));
      }
    });

    // For chained-route frameworks (Express/Fastify/Hono) also scan route registrations
    if (this.descriptor.routeStyle === 'chained' && this.descriptor.chainedRoute) {
      methods.push(...this.parseChainedRoutes(tree.rootNode, filePath));
    }

    return methods;
  }

  // ---------------------------------------------------------------------------
  // Chained route parsing  (Express / Fastify / Hono)
  // router.get('/orders', async (req, res) => { ... })
  // ---------------------------------------------------------------------------

  private parseChainedRoutes(root: SyntaxNode, filePath: string): ParsedMethod[] {
    const { chainedRoute, httpMethodMap } = this.descriptor;
    if (!chainedRoute) return [];

    const methods: ParsedMethod[] = [];
    // Derive a readable "class" name from the file (e.g. orders.routes.ts → OrdersRoutes)
    const className = path.basename(filePath, path.extname(filePath))
      .split(/[.\-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');

    this.walkNode(root, (node) => {
      if (node.type !== 'call_expression') return;

      const fnNode = node.childForFieldName('function');
      if (!fnNode || fnNode.type !== 'member_expression') return;

      // Check receiver object name (app, router, fastify, …)
      const objNode = fnNode.childForFieldName('object');
      const objName = objNode?.text;
      if (!objName || !chainedRoute.receiverNames.includes(objName)) return;

      // Check HTTP method (get, post, put, delete, …)
      const propNode = fnNode.childForFieldName('property');
      const propName = propNode?.text;
      if (!propName || !chainedRoute.methods.includes(propName)) return;

      const httpMethod = httpMethodMap[propName];
      if (!httpMethod) return;

      // Route path — first string argument
      const argsNode = node.childForFieldName('arguments');
      if (!argsNode) return;
      const namedArgs = argsNode.namedChildren;
      const routePath = namedArgs.find((n) => n.type === 'string')
        ?.namedChildren.find((n) => n.type === 'string_fragment')?.text ?? '';

      // Handler — last arrow_function or function in the argument list
      const handlerNode = [...namedArgs].reverse().find((n) =>
        ['arrow_function', 'function_expression', 'function'].includes(n.type),
      );
      if (!handlerNode) return;

      const bodyNode = handlerNode.childForFieldName('body');
      const rawBody = bodyNode?.text ?? handlerNode.text;
      const lineNumber = node.startPosition.row + 1;
      const methodName = this.chainedRouteMethodName(httpMethod, routePath);
      const calls = bodyNode ? this.extractCallSites(bodyNode) : [];

      methods.push({
        className,
        methodName,
        classDecorators: [],
        methodDecorators: [],
        flowStepTag: undefined,
        httpMethod,
        routePath,
        controllerPrefix: undefined,
        docstring: undefined,
        rawBody,
        filePath,
        lineNumber,
        calls,
        constructorInjections: new Map(),
        nodeType: 'controller',
      });
    });

    return methods;
  }

  /**
   * Converts an HTTP method + route path into a readable method name.
   * GET /orders/:id  →  getOrdersById
   * POST /           →  postRoot
   */
  private chainedRouteMethodName(httpMethod: string, routePath: string): string {
    const slug = routePath
      .replace(/^\//, '')
      .split('/')
      .map((seg) => {
        if (!seg) return 'Root';
        if (seg.startsWith(':') || seg.startsWith('*')) return 'By' + seg.slice(1).charAt(0).toUpperCase() + seg.slice(2);
        return seg.charAt(0).toUpperCase() + seg.slice(1);
      })
      .join('') || 'Root';
    return httpMethod.toLowerCase() + slug;
  }

  // ---------------------------------------------------------------------------
  // Class → ParsedMethod[]
  // ---------------------------------------------------------------------------

  private parseClass(classNode: SyntaxNode, source: string, filePath: string): ParsedMethod[] {
    const classNameNode = classNode.childForFieldName('name');
    const className = classNameNode?.text ?? 'AnonymousClass';

    // Class decorators live on the PARENT (export_statement), not on class_declaration itself.
    // e.g. export_statement > [decorator, decorator, export, class_declaration]
    const classDecorators = this.getClassDecoratorNames(classNode);
    const nodeType = this.classifyNodeType(classDecorators);
    const controllerPrefix = this.extractControllerPrefix(classNode);

    const bodyNode = classNode.childForFieldName('body');
    if (!bodyNode) return [];

    const constructorInjections = this.extractConstructorInjections(bodyNode);
    const methods: ParsedMethod[] = [];

    // Method decorators live in class_body as SIBLINGS before each method_definition,
    // not as children of the method_definition node.
    // Walk class_body children, accumulating decorators until we hit a method.
    let pendingDecorators: SyntaxNode[] = [];

    for (const child of bodyNode.children) {
      if (child.type === 'decorator') {
        pendingDecorators.push(child);
        continue;
      }

      if (child.type === 'method_definition') {
        const methodDecorators = pendingDecorators;
        pendingDecorators = [];

        const methodNameNode = child.childForFieldName('name');
        const methodName = methodNameNode?.text ?? 'anonymous';
        if (methodName === 'constructor') continue;

        const flowStepTag = this.extractFlowStepTagFromDecorators(methodDecorators);
        const { httpMethod, routePath } = this.extractHttpDecoratorFromDecorators(methodDecorators);
        const docstring = this.extractJsDoc(child);

        const bodyBlock = child.childForFieldName('body');
        const rawBody = bodyBlock?.text ?? '';
        const lineNumber = child.startPosition.row + 1;
        const calls = bodyBlock ? this.extractCallSites(bodyBlock) : [];

        methods.push({
          className,
          methodName,
          classDecorators,
          methodDecorators: methodDecorators.map((d) => this.getDecoratorName(d)).filter(Boolean) as string[],
          flowStepTag,
          httpMethod,
          routePath,
          controllerPrefix,
          docstring,
          rawBody,
          filePath,
          lineNumber,
          calls,
          constructorInjections,
          nodeType,
        });
        continue;
      }

      // Any other node type (field_definition, etc.) resets the decorator accumulator
      pendingDecorators = [];
    }

    return methods;
  }

  // ---------------------------------------------------------------------------
  // Decorator helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the name of the decorator (e.g. "Controller", "Get", "Injectable").
   * Handles: @Name, @Name(), @Name('arg')
   */
  private getDecoratorName(decoratorNode: SyntaxNode): string | undefined {
    // child(0) = "@", child(1) = identifier | call_expression | member_expression
    const expr = decoratorNode.child(1);
    if (!expr) return undefined;

    if (expr.type === 'identifier') return expr.text;

    if (expr.type === 'call_expression') {
      const fn = expr.childForFieldName('function');
      if (!fn) return undefined;
      if (fn.type === 'identifier') return fn.text;
      if (fn.type === 'member_expression') return fn.childForFieldName('property')?.text;
    }

    return undefined;
  }

  /**
   * Returns decorator names for a class.
   * Class decorators sit on the PARENT (export_statement), not on class_declaration.
   */
  private getClassDecoratorNames(classNode: SyntaxNode): string[] {
    const parent = classNode.parent;
    if (!parent) return [];
    const names: string[] = [];
    for (const child of parent.children) {
      if (child === classNode) break; // stop when we reach the class itself
      if (child.type === 'decorator') {
        const name = this.getDecoratorName(child);
        if (name) names.push(name);
      }
    }
    return names;
  }

  /** Returns the first string argument of a decorator, e.g. 'users' from @Controller('users') */
  private getDecoratorFirstStringArg(decoratorNode: SyntaxNode): string | undefined {
    const expr = decoratorNode.child(1);
    if (!expr || expr.type !== 'call_expression') return undefined;

    const argsNode = expr.childForFieldName('arguments');
    if (!argsNode) return undefined;

    const firstArg = argsNode.namedChildren[0];
    if (!firstArg) return undefined;

    // string: 'foo' or "foo"
    if (firstArg.type === 'string') {
      // Strip surrounding quotes
      return firstArg.text.slice(1, -1);
    }
    // template_string: `foo` — less common for route paths but handle it
    if (firstArg.type === 'template_string') {
      return firstArg.text.slice(1, -1);
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Specific decorator extractors — operate on pre-collected decorator nodes
  // ---------------------------------------------------------------------------

  private extractFlowStepTagFromDecorators(decorators: SyntaxNode[]): string | undefined {
    const decoratorName = this.descriptor.flowStepDecorator;
    for (const d of decorators) {
      if (this.getDecoratorName(d) !== decoratorName) continue;
      return this.getDecoratorFirstStringArg(d);
    }
    return undefined;
  }

  private extractHttpDecoratorFromDecorators(decorators: SyntaxNode[]): { httpMethod?: string; routePath?: string } {
    const { routeDecorators, httpMethodMap } = this.descriptor;
    for (const d of decorators) {
      const name = this.getDecoratorName(d);
      if (!name || !routeDecorators.includes(name)) continue;
      return { httpMethod: httpMethodMap[name], routePath: this.getDecoratorFirstStringArg(d) ?? '' };
    }
    return {};
  }

  /**
   * Controller prefix lives on the parent (export_statement) as a sibling decorator.
   */
  private extractControllerPrefix(classNode: SyntaxNode): string | undefined {
    const { controllerDecorators } = this.descriptor;
    const parent = classNode.parent;
    if (!parent) return undefined;

    for (const child of parent.children) {
      if (child === classNode) break;
      if (child.type !== 'decorator') continue;
      const name = this.getDecoratorName(child);
      if (!name || !controllerDecorators.includes(name)) continue;
      return this.getDecoratorFirstStringArg(child) ?? '';
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // JSDoc extraction
  // ---------------------------------------------------------------------------

  /**
   * Looks backwards from the method_definition through its preceding siblings in class_body.
   * Skips past any decorator siblings, then checks if there's a JSDoc block comment.
   */
  private extractJsDoc(methodNode: SyntaxNode): string | undefined {
    let sibling = methodNode.previousSibling; // use previousSibling (includes all, not just named)

    // Skip whitespace-only text nodes and decorator nodes
    while (sibling && (sibling.type === 'decorator' || sibling.isNamed === false)) {
      sibling = sibling.previousSibling;
    }

    if (!sibling || sibling.type !== 'comment') return undefined;

    const text = sibling.text;
    if (!text.startsWith('/**')) return undefined;

    return text
      .replace(/^\/\*\*/, '')
      .replace(/\*\/$/, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim() || undefined;
  }

  // ---------------------------------------------------------------------------
  // Constructor injection extraction
  // ---------------------------------------------------------------------------

  /**
   * Reads the constructor of a class body and returns paramName → TypeName.
   * e.g. `constructor(private readonly deploymentService: DeploymentService)`
   *      → Map { 'deploymentService' => 'DeploymentService' }
   */
  private extractConstructorInjections(classBodyNode: SyntaxNode): Map<string, string> {
    const injections = new Map<string, string>();

    for (const member of classBodyNode.namedChildren) {
      if (member.type !== 'method_definition') continue;
      if (member.childForFieldName('name')?.text !== 'constructor') continue;

      const paramsNode = member.childForFieldName('parameters');
      if (!paramsNode) break;

      for (const param of paramsNode.namedChildren) {
        // required_parameter or optional_parameter
        if (!['required_parameter', 'optional_parameter'].includes(param.type)) continue;

        const paramName = this.extractParamName(param);
        const typeName = this.extractParamTypeName(param);
        if (paramName && typeName) {
          injections.set(paramName, typeName);
        }
      }
      break; // only one constructor
    }

    return injections;
  }

  private extractParamName(paramNode: SyntaxNode): string | undefined {
    // Field 'pattern' holds the identifier in tree-sitter-typescript
    const pattern = paramNode.childForFieldName('pattern');
    if (pattern?.type === 'identifier') return pattern.text;

    // Fallback: find identifier child before any type_annotation
    for (const child of paramNode.children) {
      if (child.type === 'identifier') return child.text;
      if (child.type === 'type_annotation') break;
    }
    return undefined;
  }

  private extractParamTypeName(paramNode: SyntaxNode): string | undefined {
    const typeAnnotation = paramNode.childForFieldName('type');
    if (!typeAnnotation) return undefined;

    // type_annotation: ": TypeName" or ": Generic<TypeName>"
    // The first named child is the actual type node
    const typeNode = typeAnnotation.namedChildren[0];
    if (!typeNode) return undefined;

    if (typeNode.type === 'type_identifier') return typeNode.text;

    // Generic: e.g. Repository<User> — use the outer type name
    if (typeNode.type === 'generic_type') {
      return typeNode.childForFieldName('name')?.text;
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Call site extraction
  // ---------------------------------------------------------------------------

  private extractCallSites(bodyNode: SyntaxNode): CallSite[] {
    const calls = new Map<string, CallSite>();

    this.walkNode(bodyNode, (node) => {
      if (node.type !== 'call_expression') return;

      const fnNode = node.childForFieldName('function');
      if (!fnNode) return;

      if (fnNode.type === 'member_expression') {
        const method = fnNode.childForFieldName('property')?.text;
        if (!method) return;

        const objNode = fnNode.childForFieldName('object');
        let object: string | undefined;

        if (objNode?.type === 'member_expression') {
          // this.service.method() → object = "service"
          object = objNode.childForFieldName('property')?.text;
        } else if (objNode?.type === 'identifier') {
          // service.method() → object = "service"
          object = objNode.text;
        }
        // this.method() → objNode.type === 'this' → object stays undefined

        const key = `${object ?? ''}#${method}`;
        if (!calls.has(key)) calls.set(key, { method, object });

      } else if (fnNode.type === 'identifier') {
        const method = fnNode.text;
        const key = `#${method}`;
        if (!calls.has(key)) calls.set(key, { method });
      }
    });

    return [...calls.values()];
  }

  // ---------------------------------------------------------------------------
  // Node classification
  // ---------------------------------------------------------------------------

  private classifyNodeType(decorators: string[]): 'controller' | 'service' | 'utility' | 'unknown' {
    const { controllerDecorators, serviceDecorators } = this.descriptor;
    if (decorators.some((d) => controllerDecorators.includes(d))) return 'controller';
    if (decorators.some((d) => serviceDecorators.includes(d))) return 'service';
    return 'utility';
  }

  // ---------------------------------------------------------------------------
  // Graph construction
  // ---------------------------------------------------------------------------

  private buildGraph(methods: ParsedMethod[]): FlowGraph {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    // Collision-free index: className#methodName → nodeId
    const methodIndex = new Map<string, string>();
    // Ambiguity index: methodName → all nodeIds with that name
    const methodNameIndex = new Map<string, string[]>();

    for (const method of methods) {
      const nodeId = `${method.filePath}:${method.className}#${method.methodName}:${method.lineNumber}`;
      methodIndex.set(`${method.className}#${method.methodName}`, nodeId);

      const candidates = methodNameIndex.get(method.methodName) ?? [];
      candidates.push(nodeId);
      methodNameIndex.set(method.methodName, candidates);

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
        controllerPrefix: method.controllerPrefix,
      });
    }

    for (const method of methods) {
      const fromId = `${method.filePath}:${method.className}#${method.methodName}:${method.lineNumber}`;

      for (let i = 0; i < method.calls.length; i++) {
        const call = method.calls[i];
        const candidates = methodNameIndex.get(call.method) ?? [];
        let toId: string | undefined;

        if (candidates.length === 1) {
          // Unambiguous — only one method with this name
          toId = candidates[0];
        } else if (candidates.length > 1 && call.object) {
          // Ambiguous but we know the object — resolve via constructor injection
          const injectedClassName = method.constructorInjections.get(call.object);
          if (injectedClassName) {
            toId = methodIndex.get(`${injectedClassName}#${call.method}`);

            if (!toId) {
              // Param renamed (e.g. `svc` for `DeploymentService`): filter by class name in nodeId
              const match = candidates.filter((id) => id.includes(`:${injectedClassName}#`));
              if (match.length === 1) toId = match[0];
            }
          }
        }
        // Truly ambiguous with no injection context → skip rather than connect wrong target

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

  // ---------------------------------------------------------------------------
  // Tree traversal utility
  // ---------------------------------------------------------------------------

  private walkNode(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
    visitor(node);
    for (const child of node.children) {
      this.walkNode(child, visitor);
    }
  }
}
