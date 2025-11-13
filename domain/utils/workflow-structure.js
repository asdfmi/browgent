import { randomUUID } from "node:crypto";
import Workflow from "../aggregates/workflow.js";
import Edge from "../value-objects/edge.js";
import Stream from "../value-objects/stream.js";
import { ValidationError } from "../errors.js";
import NodeFactory from "../factories/node-factory.js";

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

function normalizeNodeConfigShape(type, config) {
  if (!config || typeof config !== "object") {
    return config ?? null;
  }
  if (type === "click") {
    if (config.options && typeof config.options === "object") {
      const { options, ...rest } = config;
      return { ...rest, ...options };
    }
    const { options, ...rest } = config;
    void options;
    return rest;
  }
  if (type === "wait") {
    const timeout =
      typeof config.timeout === "number"
        ? config.timeout
        : typeof config.seconds === "number"
          ? config.seconds
          : null;
    if (timeout !== null) {
      return { timeout };
    }
  }
  return config;
}

function normalizeWaitNodeType(type, config) {
  if (type !== "wait" || !config || typeof config !== "object") {
    return { type, config };
  }
  const strategy =
    typeof config.strategy === "string" ? config.strategy.toLowerCase() : null;
  if (strategy !== "element_state") {
    const timeout =
      typeof config.timeout === "number"
        ? config.timeout
        : typeof config.seconds === "number"
          ? config.seconds
          : null;
    return {
      type,
      config: timeout !== null ? { timeout } : config,
    };
  }
  const conditionType =
    typeof config.conditionType === "string"
      ? config.conditionType
      : typeof config.condition?.type === "string"
        ? config.condition.type
        : "visible";
  const xpath =
    typeof config.xpath === "string" && config.xpath
      ? config.xpath
      : typeof config.condition?.xpath === "string"
        ? config.condition.xpath
        : typeof config.selector === "string"
          ? config.selector
          : "";
  const conditionTimeoutSeconds =
    typeof config.conditionTimeoutSeconds === "number"
      ? config.conditionTimeoutSeconds
      : typeof config.condition?.timeoutSeconds === "number"
        ? config.condition.timeoutSeconds
        : typeof config.conditionTimeout === "number"
          ? config.conditionTimeout
          : typeof config.timeout === "number"
            ? config.timeout
            : 10;
  return {
    type: "wait_element",
    config: {
      type: conditionType,
      xpath,
      timeout: conditionTimeoutSeconds,
    },
  };
}

function pickNodeRef(edgeInput, index, key, map) {
  const candidates = [
    edgeInput?.[key],
    edgeInput?.[`${key}Id`],
    edgeInput?.[`${key}NodeId`],
    key === "from" ? edgeInput?.source : edgeInput?.target,
    key === "from" ? edgeInput?.sourceKey : edgeInput?.targetKey,
  ];
  const raw = candidates.find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new ValidationError(`Edge[${index + 1}] is missing ${key} reference`);
  }
  const normalized = raw.trim();
  const resolved = map.get(normalized);
  if (!resolved) {
    throw new ValidationError(
      `Edge[${index + 1}] references unknown node "${normalized}"`,
    );
  }
  return resolved;
}

function resolveStreamNode(stream, key, map, index) {
  const raw =
    stream?.[key] ??
    stream?.[`${key}NodeId`] ??
    stream?.[key === "sourceNodeId" ? "from" : "to"] ??
    stream?.[key === "sourceNodeId" ? "source" : "target"];
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new ValidationError(`Stream[${index + 1}] is missing ${key}`);
  }
  const normalized = raw.trim();
  const resolved = map.get(normalized);
  if (!resolved) {
    throw new ValidationError(
      `Stream[${index + 1}] references unknown node "${normalized}"`,
    );
  }
  return resolved;
}

export function normalizeWorkflowStructure({
  workflowId,
  name,
  nodes = [],
  edges = [],
  streams = [],
}) {
  if (!workflowId || typeof workflowId !== "string") {
    throw new ValidationError("workflowId is required");
  }
  if (!name || typeof name !== "string") {
    throw new ValidationError("Workflow name is required");
  }

  const nodeKeyMap = new Map();
  const normalizedNodes = nodes.map((nodeInput, index) => {
    if (!nodeInput || typeof nodeInput !== "object") {
      throw new ValidationError(`Node[${index + 1}] must be an object`);
    }
    const providedId =
      typeof nodeInput.id === "string" && nodeInput.id.trim()
        ? nodeInput.id.trim()
        : null;
    const providedKey =
      typeof nodeInput.nodeKey === "string" && nodeInput.nodeKey.trim()
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
    const labelled =
      typeof nodeInput.name === "string" && nodeInput.name.trim()
        ? nodeInput.name.trim()
        : id;
    const positionX = toFiniteNumber(
      nodeInput.positionX ??
        nodeInput.position?.x ??
        nodeInput.position?.left ??
        nodeInput.x ??
        nodeInput.left,
    );
    const positionY = toFiniteNumber(
      nodeInput.positionY ??
        nodeInput.position?.y ??
        nodeInput.position?.top ??
        nodeInput.y ??
        nodeInput.top,
    );
    const normalizedTypeInput =
      typeof nodeInput.type === "string" && nodeInput.type.trim()
        ? nodeInput.type.trim()
        : "task";
    const waitAdjusted = normalizeWaitNodeType(
      normalizedTypeInput,
      nodeInput.config ?? null,
    );
    const normalizedType = waitAdjusted.type;
    const normalizedConfig = normalizeNodeConfigShape(
      normalizedType,
      waitAdjusted.config ?? null,
    );
    return {
      id,
      nodeKey: providedKey ?? id,
      workflowId,
      name: labelled,
      type: normalizedType,
      config: normalizedConfig,
      positionX,
      positionY,
    };
  });

  const normalizedEdges = edges.map((edgeInput, index) => {
    if (!edgeInput || typeof edgeInput !== "object") {
      throw new ValidationError(`Edge[${index + 1}] must be an object`);
    }
    const providedKey =
      typeof edgeInput.edgeKey === "string" && edgeInput.edgeKey.trim()
        ? edgeInput.edgeKey.trim()
        : null;
    const fromNodeId = pickNodeRef(edgeInput, index, "from", nodeKeyMap);
    const toCandidate =
      edgeInput?.to ??
      edgeInput?.target ??
      edgeInput?.toNodeId ??
      edgeInput?.targetNodeId ??
      edgeInput?.targetKey ??
      null;
    const toNodeId = toCandidate
      ? pickNodeRef({ ...edgeInput, to: toCandidate }, index, "to", nodeKeyMap)
      : null;
    const edgeId =
      typeof edgeInput.id === "string" && edgeInput.id.trim()
        ? edgeInput.id.trim()
        : randomUUID();
    return {
      id: edgeId,
      edgeKey: providedKey ?? edgeId,
      workflowId,
      fromNodeId,
      toNodeId,
      condition: edgeInput.condition ?? null,
      priority:
        typeof edgeInput.priority === "number" ? edgeInput.priority : null,
      label: typeof edgeInput.label === "string" ? edgeInput.label : null,
      metadata:
        edgeInput.metadata && typeof edgeInput.metadata === "object"
          ? edgeInput.metadata
          : null,
    };
  });

  const normalizedStreams = streams.map((streamInput, index) => {
    if (!streamInput || typeof streamInput !== "object") {
      throw new ValidationError(`Stream[${index + 1}] must be an object`);
    }
    const sourceNodeId = resolveStreamNode(
      streamInput,
      "sourceNodeId",
      nodeKeyMap,
      index,
    );
    const targetNodeId = resolveStreamNode(
      streamInput,
      "targetNodeId",
      nodeKeyMap,
      index,
    );
    if (sourceNodeId === targetNodeId) {
      throw new ValidationError(
        `Stream[${index + 1}] source and target cannot match`,
      );
    }
    return {
      id:
        typeof streamInput.id === "string" && streamInput.id.trim()
          ? streamInput.id.trim()
          : randomUUID(),
      workflowId,
      sourceNodeId,
      targetNodeId,
    };
  });

  const workflow = new Workflow({
    id: workflowId,
    name: name.trim(),
    nodes: normalizedNodes.map((node) =>
      NodeFactory.create({
        id: node.id,
        name: node.name,
        type: node.type,
        config: node.config,
      }),
    ),
    edges: normalizedEdges.map(
      (edge) =>
        new Edge({
          from: edge.fromNodeId,
          to: edge.toNodeId,
          condition: edge.condition,
          priority: edge.priority,
        }),
    ),
    streams: normalizedStreams.map(
      (stream) =>
        new Stream({
          sourceNodeId: stream.sourceNodeId,
          targetNodeId: stream.targetNodeId,
        }),
    ),
  });

  return {
    workflow,
    nodes: normalizedNodes,
    edges: normalizedEdges,
    streams: normalizedStreams,
  };
}

export function serializeWorkflow(metadata, structure) {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description ?? null,
    createdAt:
      metadata.createdAt?.toISOString?.() ?? metadata.createdAt ?? null,
    updatedAt:
      metadata.updatedAt?.toISOString?.() ?? metadata.updatedAt ?? null,
    nodes: structure.nodes,
    edges: structure.edges,
    streams: structure.streams,
  };
}
