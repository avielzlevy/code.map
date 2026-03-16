export function getVSCodeUrl(absolutePath: string, line: number): string {
  const safePath = absolutePath || "/";
  const safeLine = Number.isFinite(line) && line > 0 ? line : 1;
  return `vscode://file${safePath}:${safeLine}`;
}
