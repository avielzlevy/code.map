import { ExecutionPath, FlowNode, GuideArtifact } from "./flow-types";
import { DrillEntry } from "@/app/app/page";

export interface FlowGuideStep {
  node: FlowNode;
  drillStack: DrillEntry[];
  /** Commit narration for change-driven guides (the "why"). Absent for path tours. */
  narration?: string;
  endpoint?: string;
}

/**
 * Depth-first walk of a path's node tree, building a flat sequence of guide
 * steps. Each step records the node to highlight and the drillStack needed
 * to reach it, so the caller can drive FlowCanvas to the right layer.
 */
export function buildGuideSequence(path: ExecutionPath): FlowGuideStep[] {
  const sequence: FlowGuideStep[] = [];

  function walk(nodes: FlowNode[], drillStack: DrillEntry[]) {
    for (const node of nodes) {
      sequence.push({ node, drillStack: [...drillStack] });
      if (node.hasDetail && path.nodeDetails[node.id]) {
        walk(
          path.nodeDetails[node.id].nodes,
          [
            ...drillStack,
            { id: node.id, label: node.funcName, fileName: node.fileName },
          ],
        );
      }
    }
  }

  walk(path.nodes, []);
  return sequence;
}

/**
 * Builds a guide sequence from a commit/branch diff artifact, latching onto the
 * already-loaded execution paths — no new graph. Each changed node is located
 * within the live paths so the canvas can drill to it; nodes not reachable from
 * any endpoint are still surfaced (without a drill target) so nothing is dropped.
 *
 * Artifact ids are repo-relative; live node ids are absolute, so we strip
 * `repoRoot` to match — the same normalization the GitHub-link builder uses.
 */
export function buildSequenceFromArtifact(
  paths: ExecutionPath[],
  artifact: GuideArtifact,
  repoRoot: string,
): FlowGuideStep[] {
  const toRel = (id: string): string =>
    repoRoot && id.startsWith(`${repoRoot}/`) ? id.slice(repoRoot.length + 1) : id;

  const changed = new Map(artifact.steps.map((s) => [s.nodeId, s]));
  const sequence: FlowGuideStep[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    const walk = (nodes: FlowNode[], drillStack: DrillEntry[]): void => {
      for (const node of nodes) {
        const rel = toRel(node.id);
        const step = changed.get(rel);
        if (step && !seen.has(rel)) {
          seen.add(rel);
          sequence.push({
            node,
            drillStack: [...drillStack],
            narration: step.narration,
            endpoint: path.endpoint,
          });
        }
        if (node.hasDetail && path.nodeDetails[node.id]) {
          walk(path.nodeDetails[node.id].nodes, [
            ...drillStack,
            { id: node.id, label: node.funcName, fileName: node.fileName },
          ]);
        }
      }
    };
    walk(path.nodes, []);
  }

  // Changed nodes that aren't reachable from any endpoint path — surface anyway.
  for (const step of artifact.steps) {
    if (seen.has(step.nodeId)) continue;
    sequence.push({
      node: {
        id: step.nodeId,
        type: "standard",
        funcName: step.methodName,
        fileName: step.file,
        line: step.lineRange[0],
        hasDetail: false,
      },
      drillStack: [],
      narration: step.narration,
    });
  }

  return sequence;
}
