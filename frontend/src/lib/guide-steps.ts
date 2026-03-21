import { ExecutionPath, FlowNode } from "./flow-types";
import { DrillEntry } from "@/app/app/page";

export interface FlowGuideStep {
  node: FlowNode;
  drillStack: DrillEntry[];
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
