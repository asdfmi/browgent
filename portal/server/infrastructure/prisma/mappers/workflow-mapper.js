import { Workflow, Edge, Stream, NodeFactory } from "@agent-flow/domain";

export function toDomainWorkflow({
  workflowRecord,
  nodeRecords = [],
  edgeRecords = [],
  streamRecords = [],
}) {
  if (!workflowRecord) return null;
  return new Workflow({
    id: workflowRecord.id,
    name: workflowRecord.name,
    nodes: nodeRecords.map((node) =>
      NodeFactory.create({
        id: node.id,
        name: node.name,
        type: node.type,
        config: node.config ?? null,
      }),
    ),
    edges: edgeRecords.map(
      (edge) =>
        new Edge({
          from: edge.fromNodeId,
          to: edge.toNodeId,
          condition: edge.condition,
          priority: edge.priority,
        }),
    ),
    streams: streamRecords.map(
      (stream) =>
        new Stream({
          sourceNodeId: stream.sourceNodeId,
          targetNodeId: stream.targetNodeId,
        }),
    ),
  });
}
