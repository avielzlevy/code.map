import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { FlowLogger } from '../logger/flow-logger';
import {
  GUIDE_DIFF_CONTEXT,
  GUIDE_LANGUAGE_BY_EXT,
  GUIDE_MAX_FUNCTION_LINES,
} from '../constants';
import { GuideChangeType, GuideDiff, GuideDiffLine } from '../dto/code-map-config.dto';

const LOGGER_CONTEXT = 'GuideDiffService';

/**
 * Snapshots a function's before/after code from git at guide-author time.
 *
 * It captures the **whole function** (not just the changed hunk), with the
 * changed lines marked — so the narration can point at any line of the function
 * and the viewer shows the full context, not a tiny slice. It does this by
 * diffing against `base` with wide context, then clipping the unified diff to
 * the function's line range. Brand-new / untracked files fall back to reading
 * the function straight off disk.
 *
 * No-ops to an empty diff on any failure — the guide still plays, just without
 * before/after panes for that step.
 */
export class GuideDiffService {
  /** Build the before/after diff for one function (full function body). */
  snapshot(
    root: string,
    relFile: string,
    methodName: string,
    startLine: number,
    changeType: GuideChangeType,
    base = 'HEAD',
  ): GuideDiff {
    const language = this.languageFor(relFile);
    try {
      const abs = path.join(root, relFile);
      const fileLines = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split('\n') : [];
      const fnAfter = fileLines.length ? this.extractFunction(fileLines, startLine, language) : [];
      const endLine = startLine + fnAfter.length - 1;

      // Added function: there is no "before" — show the whole new body.
      if (changeType === 'added') {
        return { language, before: null, after: fnAfter.map((text) => ({ text, kind: 'added' })) };
      }

      // Edited/removed: clip the unified diff to the function's line range so we
      // get the full function with adds/removes marked.
      const raw = fnAfter.length ? this.gitDiff(root, relFile, base) : '';
      if (raw) {
        const { before, after } = this.clipDiff(raw, startLine, endLine);
        if (after.length > 0 || before.length > 0) {
          if (changeType === 'removed') return { language, before, after: null };
          return { language, before, after };
        }
      }

      // No diff against base (e.g. already committed and no base ref given) — show
      // the full current function so the narration still has every line to point at.
      return this.fromWorkingTree(fnAfter, changeType, language);
    } catch (err) {
      FlowLogger.warn(LOGGER_CONTEXT, 'Diff snapshot failed; emitting empty diff', {
        file: relFile,
        method: methodName,
        error: (err as Error).message,
      });
      return { language, before: null, after: null };
    }
  }

  /** `git diff <base>` (base → working tree) for a file, with wide context. */
  private gitDiff(root: string, relFile: string, base: string): string {
    try {
      return execFileSync(
        'git',
        ['diff', base, '--no-color', `-U${GUIDE_DIFF_CONTEXT}`, '--', relFile],
        { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      );
    } catch {
      return '';
    }
  }

  /**
   * Reconstruct before/after panes from a unified diff, clipped to a function's
   * after-side line range [startLine, endLine]. Tracks the after-side line number
   * across hunks: ` ` context → both panes, `+` added → after, `-` removed →
   * before (kept when it sits inside the function region).
   */
  private clipDiff(raw: string, startLine: number, endLine: number): { before: GuideDiffLine[]; after: GuideDiffLine[] } {
    const before: GuideDiffLine[] = [];
    const after: GuideDiffLine[] = [];
    let afterNo = 0;
    for (const line of raw.split('\n')) {
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (h) {
        afterNo = Number(h[1]);
        continue;
      }
      if (!/^[ +-]/.test(line)) continue; // skip headers / metadata
      const text = line.slice(1);
      const ch = line[0];
      if (ch === ' ') {
        if (afterNo >= startLine && afterNo <= endLine) {
          before.push({ text, kind: 'context' });
          after.push({ text, kind: 'context' });
        }
        afterNo++;
      } else if (ch === '+') {
        if (afterNo >= startLine && afterNo <= endLine) after.push({ text, kind: 'added' });
        afterNo++;
      } else {
        // removed line — sits at the current after position; keep it if inside the fn
        if (afterNo >= startLine && afterNo <= endLine + 1) before.push({ text, kind: 'removed' });
      }
    }
    return { before, after };
  }

  /** Fallback (untracked / no-diff): show the full current function. */
  private fromWorkingTree(fnAfter: string[], changeType: GuideChangeType, language: string): GuideDiff {
    if (fnAfter.length === 0) return { language, before: null, after: null };
    const body = fnAfter.map((text): GuideDiffLine => ({ text, kind: 'context' }));
    if (changeType === 'removed') return { language, before: body, after: null };
    return { language, before: null, after: body };
  }

  /**
   * Best-effort function-body extraction from a start line. Brace-balanced for
   * C-like languages, indentation-based for Python. Capped for safety.
   */
  private extractFunction(source: string[], startLine: number, language: string): string[] {
    const begin = Math.max(0, startLine - 1);
    const limit = Math.min(source.length, begin + GUIDE_MAX_FUNCTION_LINES);

    if (language === 'python') {
      const defIndent = source[begin]?.match(/^\s*/)?.[0].length ?? 0;
      const out = [source[begin] ?? ''];
      for (let i = begin + 1; i < limit; i++) {
        const line = source[i];
        if (line.trim() === '') {
          out.push(line);
          continue;
        }
        const indent = line.match(/^\s*/)?.[0].length ?? 0;
        if (indent <= defIndent) break;
        out.push(line);
      }
      return out;
    }

    // Brace-balanced (TS/JS/etc).
    const out: string[] = [];
    let depth = 0;
    let seenOpen = false;
    for (let i = begin; i < limit; i++) {
      const line = source[i];
      out.push(line);
      for (const ch of line) {
        if (ch === '{') {
          depth++;
          seenOpen = true;
        } else if (ch === '}') {
          depth--;
        }
      }
      if (seenOpen && depth <= 0) break;
    }
    return out;
  }

  private languageFor(relFile: string): string {
    return GUIDE_LANGUAGE_BY_EXT[path.extname(relFile).toLowerCase()] ?? 'text';
  }
}
