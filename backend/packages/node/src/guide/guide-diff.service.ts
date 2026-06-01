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
 * Snapshots a function's before/after code from git at guide-author time, so the
 * written guide is portable (no live working tree needed to replay it).
 *
 * Strategy is hunk-based and language-agnostic: it reconstructs both panes from
 * the unified `git diff HEAD` of the file — context+removed lines form `before`,
 * context+added lines form `after`. A brand-new (untracked) file has no diff, so
 * we fall back to extracting the function body straight from the working tree.
 */
export class GuideDiffService {
  /** Build the before/after diff for one function. Never throws — degrades to empty. */
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
      const raw = this.gitDiff(root, relFile, base);
      if (raw) {
        const hunk = this.pickHunk(raw, startLine);
        if (hunk) return this.shape(this.splitHunk(hunk), changeType, language);
      }
      // No diff (untracked/new file, or unchanged) — read the function from disk.
      return this.snapshotFromWorkingTree(root, relFile, methodName, startLine, changeType, language);
    } catch (err) {
      FlowLogger.warn(LOGGER_CONTEXT, 'Diff snapshot failed; emitting empty diff', {
        file: relFile,
        method: methodName,
        error: (err as Error).message,
      });
      return { language, before: null, after: null };
    }
  }

  /** `git diff <base>` (base → working tree) for a file, or '' when git fails / nothing changed. */
  private gitDiff(root: string, relFile: string, base: string): string {
    try {
      return execFileSync(
        'git',
        ['diff', base, '--no-color', `-U${GUIDE_DIFF_CONTEXT}`, '--', relFile],
        { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      );
    } catch {
      return '';
    }
  }

  /**
   * Pick the hunk covering the function. Hunk headers read `@@ -a,b +c,d @@`,
   * where c is the 1-based start line on the AFTER (working-tree) side — the same
   * coordinate space as the node's `startLine`. Prefer the hunk whose after-range
   * contains the line; else the first hunk at/after it; else the first hunk.
   */
  private pickHunk(raw: string, startLine: number): string[] | null {
    const lines = raw.split('\n');
    const headers: { index: number; afterStart: number; afterCount: number }[] = [];
    lines.forEach((line, index) => {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) headers.push({ index, afterStart: Number(m[1]), afterCount: m[2] ? Number(m[2]) : 1 });
    });
    if (headers.length === 0) return null;

    const bodyOf = (hunkIdx: number): string[] => {
      const start = headers[hunkIdx].index + 1;
      const end = hunkIdx + 1 < headers.length ? headers[hunkIdx + 1].index : lines.length;
      return lines.slice(start, end).filter((l) => /^[ +-]/.test(l));
    };

    const containing = headers.findIndex(
      (h) => startLine >= h.afterStart && startLine <= h.afterStart + h.afterCount,
    );
    if (containing >= 0) return bodyOf(containing);

    const after = headers.findIndex((h) => h.afterStart >= startLine);
    return bodyOf(after >= 0 ? after : 0);
  }

  /** Reconstruct before/after panes from a unified-diff hunk body. */
  private splitHunk(hunk: string[]): { before: GuideDiffLine[]; after: GuideDiffLine[] } {
    const before: GuideDiffLine[] = [];
    const after: GuideDiffLine[] = [];
    for (const line of hunk) {
      const text = line.slice(1);
      if (line.startsWith('+')) after.push({ text, kind: 'added' });
      else if (line.startsWith('-')) before.push({ text, kind: 'removed' });
      else {
        before.push({ text, kind: 'context' });
        after.push({ text, kind: 'context' });
      }
    }
    return { before, after };
  }

  /** Drop the unused pane per change type (added → no before, removed → no after). */
  private shape(
    panes: { before: GuideDiffLine[]; after: GuideDiffLine[] },
    changeType: GuideChangeType,
    language: string,
  ): GuideDiff {
    if (changeType === 'added') return { language, before: null, after: panes.after };
    if (changeType === 'removed') return { language, before: panes.before, after: null };
    return { language, before: panes.before, after: panes.after };
  }

  /** Fallback for untracked/new files: pull the function body straight off disk. */
  private snapshotFromWorkingTree(
    root: string,
    relFile: string,
    methodName: string,
    startLine: number,
    changeType: GuideChangeType,
    language: string,
  ): GuideDiff {
    const abs = path.join(root, relFile);
    if (!fs.existsSync(abs)) return { language, before: null, after: null };
    const source = fs.readFileSync(abs, 'utf8').split('\n');
    const body = this.extractFunction(source, startLine, language).map(
      (text): GuideDiffLine => ({ text, kind: 'context' }),
    );
    if (changeType === 'removed') return { language, before: body, after: null };
    // Brand-new or unchanged-but-untracked: show the function as the "after".
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
