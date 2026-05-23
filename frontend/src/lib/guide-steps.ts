import { ExecutionPath, FlowNode, GuideArtifact, GuideChangeType } from "./flow-types";
import { DrillEntry } from "@/app/app/page";

export interface FlowGuideStep {
  node: FlowNode;
  drillStack: DrillEntry[];
  /** The LLM's explanation for this step. Absent for path tours. */
  explanation?: string;
  /** What happened to this node (added/edited/removed). Absent for path tours. */
  changeType?: GuideChangeType;
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
 * Builds a guide sequence from a guide artifact, latching onto the already-loaded
 * execution paths — no new graph. The walkthrough follows the artifact's step
 * ORDER (an LLM may have curated/reordered it), not graph-traversal order.
 *
 * Each step's node is located within the live paths so the canvas can drill to
 * it; a node not reachable from any endpoint is still surfaced (without a drill
 * target) so nothing is dropped.
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

  // Locate every node reachable in the live paths once: relId → node + how to reach it.
  const located = new Map<
    string,
    { node: FlowNode; drillStack: DrillEntry[]; endpoint: string }
  >();
  for (const path of paths) {
    const walk = (nodes: FlowNode[], drillStack: DrillEntry[]): void => {
      for (const node of nodes) {
        const rel = toRel(node.id);
        if (!located.has(rel)) {
          located.set(rel, { node, drillStack: [...drillStack], endpoint: path.endpoint });
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

  // Emit in the artifact's step order; fall back to a drill-less step for orphans.
  return artifact.steps.map((step): FlowGuideStep => {
    const hit = located.get(step.nodeId);
    if (hit) {
      return {
        node: hit.node,
        drillStack: hit.drillStack,
        explanation: step.explanation,
        changeType: step.changeType,
        endpoint: hit.endpoint,
      };
    }
    return {
      node: {
        id: step.nodeId,
        type: "standard",
        funcName: step.methodName,
        fileName: step.file,
        line: 0,
        hasDetail: false,
      },
      drillStack: [],
      explanation: step.explanation,
      changeType: step.changeType,
    };
  });
}
