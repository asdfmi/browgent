import { normalizeWorkflowStructure } from '../utils/workflow-structure.js';

const toArray = (value) => (Array.isArray(value) ? value : []);

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
};

export function loadWorkflowDefinition(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('workflow payload is required');
  }

  const base = input.definition && typeof input.definition === 'object'
    ? input.definition
    : input;

  const workflowId = pickString(input.workflowId, input.id, base.workflowId, base.id);
  if (!workflowId) {
    throw new Error('workflow id is required');
  }

  const name = pickString(input.name, base.name, 'Untitled Workflow');
  const nodes = toArray(base.nodes);
  if (nodes.length === 0) {
    throw new Error('workflow must include nodes');
  }

  const edges = toArray(base.edges);
  const dataBindings = toArray(base.dataBindings);

  const normalized = normalizeWorkflowStructure({
    workflowId,
    name,
    nodes,
    edges,
    dataBindings,
  });

  const startCandidate = pickString(
    input.startNodeId,
    base.startNodeId,
    input.start,
    base.start,
  );

  const startNode = (startCandidate && normalized.workflow.getNode(startCandidate))
    ? startCandidate
    : normalized.workflow.getStartNodes()[0]?.id
      ?? normalized.nodes[0]?.id
      ?? null;

  return {
    workflow: normalized.workflow,
    startNodeId: startNode,
    metadata: {
      id: workflowId,
      name,
      description: typeof base.description === 'string' ? base.description : null,
    },
  };
}
