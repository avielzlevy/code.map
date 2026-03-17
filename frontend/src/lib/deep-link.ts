export type EditorId = "vscode" | "cursor" | "windsurf" | "zed" | "antigravity" | "cline";

export const EDITORS: { id: EditorId; label: string; scheme: string }[] = [
  { id: "vscode",      label: "VS Code",     scheme: "vscode"      },
  { id: "cursor",      label: "Cursor",      scheme: "cursor"      },
  { id: "windsurf",    label: "Windsurf",    scheme: "windsurf"    },
  { id: "zed",         label: "Zed",         scheme: "zed"         },
  { id: "antigravity", label: "Antigravity", scheme: "antigravity" },
  { id: "cline",       label: "Cline",       scheme: "vscode"      },
];

export function getEditorUrl(editor: EditorId, absolutePath: string, line: number): string {
  const safePath = absolutePath || "/";
  const safeLine = Number.isFinite(line) && line > 0 ? line : 1;
  const scheme = EDITORS.find((e) => e.id === editor)?.scheme ?? "vscode";
  return `${scheme}://file${safePath}:${safeLine}`;
}

export const EDITOR_STORAGE_KEY = "code-map:preferred-editor";

// Keep legacy export for any direct callers
export function getVSCodeUrl(absolutePath: string, line: number): string {
  return getEditorUrl("vscode", absolutePath, line);
}
