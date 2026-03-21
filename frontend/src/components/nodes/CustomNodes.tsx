import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Handle, Position } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { FunctionSquare, Layers, CornerLeftUp, ChevronDown, Sparkles, ExternalLink, Tag, Check } from "lucide-react";
import type { FlowNode } from "@/lib/flow-types";
import { getEditorUrl, EDITORS, EDITOR_STORAGE_KEY, type EditorId } from "@/lib/deep-link";
import { SPRING_STANDARD, SPRING_BADGE, SPRING_DEFAULT } from "@/lib/spring";

/** Strip leading `//`, `*`, `/` characters and blank lines from a JSDoc/comment string. */
function cleanDocstring(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/^\s*[\/*]+\s?/, "").trim())
    .join("\n")
    .trim();
}

type NodeProps = FlowNode & {
  hasIncoming: boolean;
  hasOutgoing: boolean;
  isExpanded: boolean;
  isGuideActive?: boolean;
  onToggleExpand: () => void;
  onDrillDown: () => void;
};
type GhostPinData = { callerLabel: string; callerFile?: string; onBack?: () => void };

export function GhostEntryPin({ data }: { data: GhostPinData }) {
  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    data.onBack?.();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center select-none cursor-pointer group outline-none"
      onClick={handleActivate}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleActivate(e)}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/8 bg-zinc-950 group-hover:border-white/20 group-hover:bg-white/5 transition-[border-color,background-color] duration-150 max-w-xs overflow-hidden">
        <CornerLeftUp className="w-3 h-3 -scale-x-100 text-white/25 group-hover:text-white/55 transition-colors duration-150 shrink-0" />
        <div className="font-mono min-w-0 flex flex-col gap-0.5 overflow-hidden">
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[11px] text-white/30 group-hover:text-white/55 transition-colors duration-150 shrink-0">called by:</span>
            <span className="text-[11px] text-white/45 group-hover:text-white/80 transition-colors duration-150 truncate max-w-40" title={data.callerLabel}>{data.callerLabel}</span>
          </div>
          {data.callerFile && (
            <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors duration-150 truncate" title={data.callerFile}>{data.callerFile}</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

function EditorIcon({ id }: { id: EditorId }) {
  return (
    <img
      src={`/editor-icons/${id}.svg`}
      alt={id}
      width={16}
      height={16}
      className="shrink-0"
    />
  );
}

/** Inline expansion panel — slides open below the node card. */
function NodeExpansion({ data, amber }: { data: NodeProps; amber?: boolean }) {
  const [editorMenuOpen, setEditorMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; right: number; width: number } | null>(null);
  const splitButtonRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const [selectedEditor, setSelectedEditor] = useState<EditorId>(() => {
    try {
      return (localStorage.getItem(EDITOR_STORAGE_KEY) as EditorId) ?? "vscode";
    } catch {
      return "vscode";
    }
  });

  const selectEditor = (id: EditorId) => {
    setSelectedEditor(id);
    setEditorMenuOpen(false);
    try { localStorage.setItem(EDITOR_STORAGE_KEY, id); } catch { /* noop */ }
  };

  const openEditorMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editorMenuOpen && splitButtonRef.current) {
      const rect = splitButtonRef.current.getBoundingClientRect();
      setMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right, width: rect.width });
    }
    setEditorMenuOpen((o) => !o);
  }, [editorMenuOpen]);

  const editorLabel = EDITORS.find((e) => e.id === selectedEditor)?.label ?? "VS Code";

  return (
    <motion.div
      key="expansion"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={SPRING_DEFAULT}
      className="overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className={`flex gap-2 px-5 pb-3 pt-3 border-t ${amber ? "border-amber-500/15" : "border-white/8"}`}>
        {data.hasDetail && (
          <button
            onClick={(e) => { e.stopPropagation(); data.onDrillDown(); }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black py-2 px-3 rounded-md text-[12px] font-semibold hover:bg-white/90 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Drill into calls
          </button>
        )}

        {/* Open in — split button: left opens, right picks editor */}
        <div ref={splitButtonRef} className="flex-1 flex">
          <a
            href={getEditorUrl(selectedEditor, data.fileName, data.line)}
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 border border-white/15 hover:border-white/30 text-gray-400 hover:text-white py-2 px-3 rounded-l-md text-[12px] font-medium hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Open in {editorLabel}</span>
          </a>
          <button
            ref={chevronRef}
            onClick={openEditorMenu}
            className="px-2 border border-l-0 border-white/15 hover:border-white/30 text-gray-500 hover:text-white rounded-r-md hover:bg-white/5 transition-colors"
            aria-label="Choose editor"
          >
            <ChevronDown size={12} className={`transition-transform duration-150 ${editorMenuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Portal dropdown — escapes overflow-hidden ancestors */}
        {editorMenuOpen && menuPos && typeof document !== "undefined" && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setEditorMenuOpen(false)} />
            <div
              className="fixed z-[101] bg-zinc-950 border border-white/12 rounded-lg overflow-hidden shadow-xl shadow-black/60"
              style={{ bottom: menuPos.bottom, right: menuPos.right, width: menuPos.width }}
            >
              {EDITORS.map((editor) => {
                const active = editor.id === selectedEditor;
                return (
                  <button
                    key={editor.id}
                    onClick={(e) => { e.stopPropagation(); selectEditor(editor.id); }}
                    className={`w-full flex items-center gap-2.5 px-3 h-9 text-[12px] transition-colors ${
                      active ? "text-white bg-white/6" : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <EditorIcon id={editor.id} />
                    <span className="flex-1 text-left">{editor.label}</span>
                    {active && <Check size={11} className="text-white/60 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
      </div>
    </motion.div>
  );
}

/** Shared card body — identical layout for both Standard and Enhanced nodes. */
function NodeContent({ data, amber }: { data: NodeProps; amber?: boolean }) {
  return (
    <div className="px-5 pt-4 pb-3">
      {/* Header: icon + funcName + filename */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg border ${amber ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"}`}>
          <FunctionSquare className={`w-5 h-5 ${amber ? "text-amber-400" : "text-gray-400"}`} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`text-base font-semibold truncate pr-7 ${amber ? "text-amber-300" : "text-white"}`} title={data.funcName}>
            {data.funcName}
          </span>
          <span className="text-[11px] text-gray-400 font-mono truncate mt-0.5" title={data.fileName}>
            {data.fileName.split("/").pop() ?? data.fileName}
          </span>
        </div>
      </div>

      {/* FlowStep descriptor — tag icon + label, always visible when present */}
      {data.intentTag && (
        <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden">
          <Tag className="w-3 h-3 shrink-0 text-amber-400/70" />
          <span className="text-[10px] font-mono text-amber-400/70 truncate">{data.intentTag}</span>
        </div>
      )}

      {/* AI summary — truncated when closed, full when expanded */}
      <AnimatePresence>
        {data.aiSummary && (
          <motion.div
            key={data.aiSummary}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={SPRING_DEFAULT}
            className={`mt-3 flex items-start gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-md ${amber ? "bg-amber-500/5 border border-amber-500/15 text-amber-300/70" : "bg-white/5 border border-white/8 text-gray-400"}`}
          >
            <Sparkles className={`w-3 h-3 mt-0.5 shrink-0 ${amber ? "text-amber-400/50" : "text-white/30"}`} />
            <span className={data.isExpanded ? "break-words" : "truncate"}>{data.aiSummary}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JSDoc — only when closed with no AI summary, or always when expanded */}
      {(data.isExpanded || !data.aiSummary) && data.docstring && (
        <div className="mt-3 text-[11px] font-mono bg-white/5 border border-white/8 text-gray-400 px-2.5 py-1.5 rounded-md">
          <span
            className={data.isExpanded ? "whitespace-pre-wrap break-words" : "truncate block"}
            title={!data.isExpanded ? cleanDocstring(data.docstring) : undefined}
          >
            {cleanDocstring(data.docstring)}
          </span>
        </div>
      )}
    </div>
  );
}

export function StandardNode({ data }: { data: NodeProps }) {
  return (
    <motion.div
      className={`rounded-xl bg-zinc-950 border w-112.5 group relative
        ${data.isGuideActive
          ? "border-white/70 shadow-[0_0_0_3px_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.6)]"
          : data.hasDetail
            ? "border-white/20 hover:border-white/40 cursor-pointer transition-colors"
            : "border-white/10 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        }`}
      initial="rest"
      whileHover={data.hasDetail ? "hover" : undefined}
      animate="rest"
      variants={data.hasDetail ? {
        rest: { y: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.6), 2px 4px 0 -1px rgba(255,255,255,0.07), 5px 8px 0 -2px rgba(255,255,255,0.035)" },
        hover: { y: -3, boxShadow: "0 4px 24px rgba(0,0,0,0.6), 3px 5px 0 -1px rgba(255,255,255,0.11), 6px 10px 0 -2px rgba(255,255,255,0.055)" },
      } : {
        rest: { y: 0 },
      }}
      transition={SPRING_STANDARD}
    >
      {data.hasDetail && (
        <div
          title="Has nested calls"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/22 border border-white/45 flex items-center justify-center z-20"
        >
          <Layers className="w-3.5 h-3.5 text-white/80" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_6px_rgba(255,255,255,0.3)]"
      />

      <NodeContent data={data} />

      <AnimatePresence>
        {data.isExpanded && <NodeExpansion data={data} />}
      </AnimatePresence>

      {/* Chevron toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onToggleExpand(); }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={data.isExpanded ? "Collapse details" : "Expand details"}
        className="w-full h-9 border-t border-white/8 hover:bg-white/4 transition-colors rounded-b-xl flex items-center justify-center overflow-hidden"
      >
        <motion.div animate={{ rotate: data.isExpanded ? 180 : 0 }} transition={SPRING_DEFAULT}>
          <ChevronDown className={`w-3.5 h-3.5 transition-colors ${data.isExpanded ? "text-white/60" : "text-white/50"}`} />
        </motion.div>
      </button>

      <Handle
        type="source"
        position={Position.Right}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-white! shadow-[0_0_6px_rgba(255,255,255,0.3)]"
      />
    </motion.div>
  );
}

export function EnhancedNode({ data }: { data: NodeProps }) {
  return (
    <motion.div
      className={`rounded-xl bg-zinc-950 border w-112.5 relative group
        ${data.isGuideActive
          ? "border-amber-400/90 shadow-[0_0_0_3px_rgba(245,158,11,0.15),0_4px_30px_rgba(245,158,11,0.18)]"
          : data.hasDetail
            ? "border-amber-500/50 hover:border-amber-400 cursor-pointer transition-colors"
            : "border-amber-500/30 hover:border-amber-500/40 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        }`}
      initial="rest"
      whileHover={data.hasDetail ? "hover" : undefined}
      animate="rest"
      variants={data.hasDetail ? {
        rest: { y: 0, boxShadow: "0 4px 30px rgba(245,158,11,0.12), 2px 4px 0 -1px rgba(245,158,11,0.10), 5px 8px 0 -2px rgba(245,158,11,0.05)" },
        hover: { y: -3, boxShadow: "0 4px 30px rgba(245,158,11,0.18), 3px 5px 0 -1px rgba(245,158,11,0.15), 6px 10px 0 -2px rgba(245,158,11,0.07)" },
      } : {
        rest: { y: 0 },
      }}
      transition={SPRING_STANDARD}
    >
      {/* Gradient tint — distinguishes enhanced nodes from standard */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-br from-amber-500/8 to-transparent" />
      </div>

      {data.hasDetail && (
        <div
          title="Has nested calls"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500/32 border border-amber-500/60 flex items-center justify-center z-20"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        data-connected={data.hasIncoming ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_8px_rgba(245,158,11,0.5)] z-20"
      />

      <div className="relative z-10">
        <NodeContent data={data} amber />
      </div>

      <AnimatePresence>
        {data.isExpanded && <NodeExpansion data={data} amber />}
      </AnimatePresence>

      {/* Chevron toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onToggleExpand(); }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={data.isExpanded ? "Collapse details" : "Expand details"}
        className="relative z-10 w-full h-9 border-t border-amber-500/15 hover:bg-amber-500/5 transition-colors rounded-b-xl flex items-center justify-center overflow-hidden"
      >
        <motion.div animate={{ rotate: data.isExpanded ? 180 : 0 }} transition={SPRING_DEFAULT}>
          <ChevronDown className={`w-3.5 h-3.5 transition-colors ${data.isExpanded ? "text-amber-400/60" : "text-amber-500/55"}`} />
        </motion.div>
      </button>

      <Handle
        type="source"
        position={Position.Right}
        data-connected={data.hasOutgoing ? "true" : "false"}
        className="w-2.5! h-2.5! border-2! border-black! bg-amber-400! shadow-[0_0_8px_rgba(245,158,11,0.5)] z-20"
      />
    </motion.div>
  );
}
