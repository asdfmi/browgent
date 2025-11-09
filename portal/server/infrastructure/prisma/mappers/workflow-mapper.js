import {
  Workflow,
  Node,
  Edge,
  DataBinding,
} from '#domain/index.js';

export function toDomainWorkflow({
  workflowRecord,
  nodeRecords = [],
  edgeRecords = [],
  bindingRecords = [],
}) {
  if (!workflowRecord) return null;
  return new Workflow({
    id: workflowRecord.id,
    name: workflowRecord.name,
    nodes: nodeRecords.map((node) => new Node({
      id: node.id,
      name: node.name,
      type: node.type,
      inputs: node.inputs ?? [],
      outputs: node.outputs ?? [],
    })),
    edges: edgeRecords.map((edge) => new Edge({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      condition: edge.condition,
      priority: edge.priority,
    })),
    dataBindings: bindingRecords.map((binding) => new DataBinding({
      sourceNodeId: binding.sourceNodeId,
      sourceOutput: binding.sourceOutput,
      targetNodeId: binding.targetNodeId,
      targetInput: binding.targetInput,
      transform: binding.transform,
    })),
  });
}
