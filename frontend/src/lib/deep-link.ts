export function getVSCodeUrl(absolutePath: string, line: number): string {
  // Use the vscode:// path format
  return `vscode://file${absolutePath}:${line}`;
}
