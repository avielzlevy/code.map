export const FLOW_STEP_METADATA_KEY = '__flow_step_description__';

/**
 * Marks a function as a named flow step with a human-readable business intent label.
 * The description overrides the raw function name in the flow graph visualization.
 *
 * @example
 * export const createUser = FlowStep('Persist new user to database')(
 *   async function createUser(data: CreateUserDto) { ... }
 * );
 *
 * // Or as a standalone tag (read by the AST parser via comment convention):
 * // @flow-step Validate request schema and authenticate caller
 * export async function POST(request: NextRequest) { ... }
 */
export function FlowStep(description: string) {
  return function <T extends (...args: any[]) => any>(fn: T): T {
    (fn as any)[FLOW_STEP_METADATA_KEY] = description;
    return fn;
  };
}
