import 'reflect-metadata';

export const FLOW_STEP_METADATA_KEY = 'flow:step:description';

/**
 * Marks a method as a named dot with a human-readable business intent label.
 * The description overrides the raw function name in the flow graph visualization.
 *
 * @example
 * @Dot('Validate user credentials and issue JWT token')
 * async login(dto: LoginDto): Promise<TokenResponse> { ... }
 */
export function Dot(description: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(FLOW_STEP_METADATA_KEY, description, target, propertyKey);
  };
}
