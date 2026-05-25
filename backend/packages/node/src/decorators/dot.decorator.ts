/**
 * Marks a method as a named dot with a human-readable business intent label.
 * The description is read from source by the AST parser — no runtime reflection needed.
 *
 * @example
 * @Dot('Validate user credentials and issue JWT token')
 * async login(dto: LoginDto): Promise<TokenResponse> { ... }
 */
export function Dot(_description: string): MethodDecorator {
  return (): void => {};
}
