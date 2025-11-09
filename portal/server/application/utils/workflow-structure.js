import { randomUUID } from 'node:crypto';
import {
  Workflow,
  Node,
  Edge,
  DataBinding,
  ValidationError,
} from '../../../domain/index.js';

const toArray = (value) => (Array.isArray(value) ? value : (value ? [value] : []));

function normalizePorts(ports, fallbackRequired) {
  return toArray(ports).map((port, index) => {
    if (typeof port === 'string') {
      return { name: port, required: fallbackRequired };
    }
    if (port && typeof port === 'object') {
      const name = typeof port.name === 'string' && port.name.trim()
        ? port.name.trim()
        : null;
      if (!name) {
        throw new ValidationError(`Port #${index + 1} is missing name`);
      }
      return {
        name,
        required: port.required === undefined ? fallbackRequired : Boolean(port.required),
      };
    }
    throw new ValidationError('Port definition must be a string or object');
  });
}

function pickNodeRef(edgeInput, index, key, map) {
  const candidates = [
    edgeInput?.[key],
    edgeInput?.[`${key}Id`],
    edgeInput?.[`${key}NodeId`],
    key === 'from' ? edgeInput?.source : edgeInput?.target,
    key === 'from' ? edgeInput?.sourceKey : edgeInput?.targetKey,
  ];
  const raw = candidates.find((value) => typeof value === 'string' && value.trim());
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new ValidationError(`Edge[${index + 1}] is missing ${key} reference`);
  }
  const normalized = raw.trim();
  const resolved = map.get(normalized);
  if (!resolved) {
    throw new ValidationError(`Edge[${index + 1}] references unknown node "${normalized}"`);
  }
  return resolved;
}

function resolveBindingNode(binding, key, map, index) {
  const raw = binding?.[key]
    ?? binding?.[`${key}NodeId`]
    ?? binding?.[key === 'sourceNodeId' ? 'from' : 'to']
    ?? binding?.[key === 'sourceNodeId' ? 'source' : 'target'];
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new ValidationError(`DataBinding[${index + 1}] is missing ${key}`);
  }
  const normalized = raw.trim();
  const resolved = map.get(normalized);
  if (!resolved) {
    throw new ValidationError(`DataBinding[${index + 1}] references unknown node "${normalized}"`);
  }
  return resolved;
}

export function normalizeWorkflowStructure({
  workflowId,
  name,
  nodes = [],
  edges = [],
  dataBindings = [],
}) {
  if (!workflowId || typeof workflowId !== 'string') {
    throw new ValidationError('workflowId is required');
  }
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Workflow name is required');
  }

  const nodeKeyMap = new Map();
  const normalizedNodes = nodes.map((nodeInput, index) => {
    if (!nodeInput || typeof nodeInput !== 'object') {
      throw new ValidationError(`Node[${index + 1}] must be an object`);
    }
    const providedId = typeof nodeInput.id === 'string' && nodeInput.id.trim()
      ? nodeInput.id.trim()
      : null;
    const providedKey = typeof nodeInput.nodeKey === 'string' && nodeInput.nodeKey.trim()
      ? nodeInput.nodeKey.trim()
      : null;
    const id = providedId ?? providedKey ?? randomUUID();
    nodeKeyMap.set(id, id);
    if (providedId && providedId !== id) {
      nodeKeyMap.set(providedId, id);
    }
    if (providedKey && providedKey !== id) {
      nodeKeyMap.set(providedKey, id);
    }
    const labelled = typeof nodeInput.name === 'string' && nodeInput.name.trim()
      ? nodeInput.name.trim()
      : id;
    return {
      id,
      workflowId,
      name: labelled,
      type:
        (typeof nodeInput.type === 'string' && nodeInput.type.trim())
          ? nodeInput.type.trim()
          : 'task',
      inputs: normalizePorts(nodeInput.inputs ?? [], true),
      outputs: normalizePorts(nodeInput.outputs ?? [], false),
      config: nodeInput.config ?? null,
    };
  });

  const normalizedEdges = edges.map((edgeInput, index) => {
    if (!edgeInput || typeof edgeInput !== 'object') {
      throw new ValidationError(`Edge[${index + 1}] must be an object`);
    }
    const fromNodeId = pickNodeRef(edgeInput, index, 'from', nodeKeyMap);
    const toCandidate = edgeInput?.to
      ?? edgeInput?.target
      ?? edgeInput?.toNodeId
      ?? edgeInput?.targetNodeId
      ?? edgeInput?.targetKey
      ?? null;
    const toNodeId = toCandidate
      ? pickNodeRef({ ...edgeInput, to: toCandidate }, index, 'to', nodeKeyMap)
      : null;
    return {
      id: (typeof edgeInput.id === 'string' && edgeInput.id.trim()) ? edgeInput.id.trim() : randomUUID(),
      workflowId,
      fromNodeId,
      toNodeId,
      condition: edgeInput.condition ?? null,
      priority: typeof edgeInput.priority === 'number' ? edgeInput.priority : null,
    };
  });

  const normalizedBindings = dataBindings.map((bindingInput, index) => {
    if (!bindingInput || typeof bindingInput !== 'object') {
      throw new ValidationError(`DataBinding[${index + 1}] must be an object`);
    }
    const sourceNodeId = resolveBindingNode(bindingInput, 'sourceNodeId', nodeKeyMap, index);
    const targetNodeId = resolveBindingNode(bindingInput, 'targetNodeId', nodeKeyMap, index);
    const targetInput =
      (typeof bindingInput.targetInput === 'string' && bindingInput.targetInput.trim())
        ? bindingInput.targetInput.trim()
        : null;
    if (!targetInput) {
      throw new ValidationError(`DataBinding[${index + 1}] requires targetInput`);
    }
    return {
      id: (typeof bindingInput.id === 'string' && bindingInput.id.trim()) ? bindingInput.id.trim() : randomUUID(),
      workflowId,
      sourceNodeId,
      sourceOutput: bindingInput.sourceOutput ?? null,
      targetNodeId,
      targetInput,
      transform: bindingInput.transform ?? null,
    };
  });

  const workflow = new Workflow({
    id: workflowId,
    name: name.trim(),
    nodes: normalizedNodes.map(
      (node) => new Node({
        id: node.id,
        name: node.name,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
      }),
    ),
    edges: normalizedEdges.map(
      (edge) => new Edge({
        from: edge.fromNodeId,
        to: edge.toNodeId,
        condition: edge.condition,
        priority: edge.priority,
      }),
    ),
    dataBindings: normalizedBindings.map(
      (binding) => new DataBinding({
        sourceNodeId: binding.sourceNodeId,
        sourceOutput: binding.sourceOutput,
        targetNodeId: binding.targetNodeId,
        targetInput: binding.targetInput,
        transform: binding.transform,
      }),
    ),
  });

  return {
    workflow,
    nodes: normalizedNodes,
    edges: normalizedEdges,
    dataBindings: normalizedBindings,
  };
}

export function serializeWorkflow(metadata, structure) {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description ?? null,
    createdAt: metadata.createdAt?.toISOString?.() ?? metadata.createdAt ?? null,
    updatedAt: metadata.updatedAt?.toISOString?.() ?? metadata.updatedAt ?? null,
    nodes: structure.nodes,
    edges: structure.edges,
    dataBindings: structure.dataBindings,
  };
}
