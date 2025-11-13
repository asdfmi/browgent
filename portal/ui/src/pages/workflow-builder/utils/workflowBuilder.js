import { BRANCH_CONDITION_TYPES, NODE_TYPES } from "../constants.js";
import {
  CLICK_BUTTON_OPTIONS,
  WAIT_ELEMENT_CONDITION_TYPES,
} from "@agent-flow/domain/value-objects/node-configs/constants.js";

export function getBuilderContext(pathname) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);
  if (segments.length === 2 && segments[0] === "workflow") {
    const identifier = segments[1];
    if (identifier === "new") {
      return { workflowId: null, isNew: true };
    }
    if (identifier) {
      return { workflowId: decodeURIComponent(identifier), isNew: false };
    }
  }
  return { workflowId: null, isNew: false };
}

export function createEmptyNode(existingNodes = []) {
  const nodeKey = globalThis.crypto.randomUUID();
  const label = generateNodeLabel(existingNodes);
  return {
    nodeKey,
    label,
    type: "navigate",
    config: getDefaultConfig("navigate"),
    positionX: null,
    positionY: null,
  };
}

function generateNodeLabel(existingNodes = []) {
  const taken = new Set(
    existingNodes
      .map((node) => (typeof node?.label === "string" ? node.label.trim() : ""))
      .filter(Boolean),
  );
  let index = existingNodes.length + 1;
  let candidate = `node_${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `node_${index}`;
  }
  return candidate;
}

export function toEditableNode(node) {
  const positionX = parseNumber(node?.positionX ?? node?.position?.x);
  const positionY = parseNumber(node?.positionY ?? node?.position?.y);
  const type = node.type ?? "navigate";
  const baseConfig =
    node.config && typeof node.config === "object"
      ? node.config
      : getDefaultConfig(type);
  const config = applyConfigDefaults(type, baseConfig);
  return {
    nodeKey: node.nodeKey ?? "",
    label: node.label ?? "",
    type,
    config,
    positionX,
    positionY,
  };
}

export function toEditableEdge(edge) {
  const edgeKey = String(edge.edgeKey || edge.id || "").trim();
  return {
    edgeKey,
    sourceKey: edge.sourceKey ?? edge.source ?? edge.from ?? "",
    targetKey: edge.targetKey ?? edge.target ?? edge.to ?? "",
    label: edge.label ?? "",
    condition:
      edge.condition && typeof edge.condition === "object"
        ? edge.condition
        : null,
    metadata:
      edge.metadata && typeof edge.metadata === "object" ? edge.metadata : null,
    priority: typeof edge.priority === "number" ? edge.priority : null,
  };
}

export function toEditableStream(stream, index = 0) {
  if (!stream || typeof stream !== "object") return null;
  const streamKey =
    typeof stream.streamKey === "string" && stream.streamKey.trim()
      ? stream.streamKey.trim()
      : typeof stream.id === "string" && stream.id.trim()
        ? stream.id.trim()
        : `stream_${index + 1}`;
  const sourceKey = String(stream.sourceKey ?? stream.fromNodeId ?? "").trim();
  const targetKey = String(stream.targetKey ?? stream.toNodeId ?? "").trim();
  return {
    streamKey,
    sourceKey,
    targetKey,
  };
}

export function getDefaultConfig(type) {
  switch (type) {
    case "navigate":
      return { url: "", waitUntil: "" };
    case "if":
      return {};
    case "wait":
      return {
        timeout: 1,
      };
    case "wait_element":
      return {
        type: WAIT_ELEMENT_CONDITION_TYPES[0],
        xpath: "",
        timeout: 10,
      };
    case "scroll":
      return { dx: 0, dy: 600 };
    case "click":
      return { xpath: "", button: "left", clickCount: 1, delay: 0, timeout: 5 };
    case "fill":
      return { xpath: "", clear: false, value: "" };
    case "press":
      return { xpath: "", key: "", delay: null };
    case "log":
      return { target: "agent-flow", level: "info", message: "" };
    case "script":
      return { code: "" };
    case "extract_text":
      return { xpath: "" };
    default:
      return {};
  }
}

export function createDefaultBranchEdge() {
  return {
    edgeKey: "",
    targetKey: "",
    condition: createDefaultBranchCondition("visible"),
    priority: null,
  };
}

export function createDefaultBranchCondition(type) {
  switch (type) {
    case "visible":
      return { visible: { xpath: "" } };
    case "exists":
      return { exists: { xpath: "" } };
    case "urlIncludes":
      return { urlIncludes: "" };
    case "delay":
      return { delay: 1 };
    case "script":
      return { script: { code: "" } };
    default:
      return { visible: { xpath: "" } };
  }
}

function normalizeWaitElementTypeValue(value) {
  if (value === "attached") return "exists";
  return value;
}

function applyConfigDefaults(type, config) {
  if (!config || typeof config !== "object") {
    return getDefaultConfig(type);
  }
  if (type === "click") {
    const defaults = getDefaultConfig("click");
    return { ...defaults, ...config };
  }
  if (type === "fill") {
    const defaults = getDefaultConfig("fill");
    return { ...defaults, ...config };
  }
  if (type === "wait") {
    const defaults = getDefaultConfig("wait");
    const normalized =
      config && typeof config === "object"
        ? {
            ...config,
            ...(config.timeout === undefined &&
            typeof config.seconds === "number"
              ? { timeout: config.seconds }
              : {}),
          }
        : config;
    return { ...defaults, ...(normalized ?? {}) };
  }
  if (type === "wait_element") {
    const defaults = getDefaultConfig("wait_element");
    const overrides =
      config && typeof config === "object"
        ? {
            ...config,
            ...(typeof config.conditionType === "string" &&
            config.type === undefined
              ? { type: config.conditionType }
              : {}),
            ...(typeof config.conditionTimeoutSeconds === "number" &&
            config.timeout === undefined
              ? { timeout: config.conditionTimeoutSeconds }
              : {}),
          }
        : {};
    return { ...defaults, ...overrides };
  }
  return config;
}

export function getBranchConditionType(condition) {
  if (!condition || typeof condition !== "object")
    return BRANCH_CONDITION_TYPES[0].value;
  if (condition.visible) return "visible";
  if (condition.exists) return "exists";
  if (typeof condition.urlIncludes === "string") return "urlIncludes";
  if (typeof condition.delay === "number") return "delay";
  if (condition.script) return "script";
  return BRANCH_CONDITION_TYPES[0].value;
}

export function parseNumber(input) {
  if (input === "" || input === null || typeof input === "undefined")
    return null;
  const num = Number(input);
  return Number.isFinite(num) ? num : null;
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildPayload(form) {
  const errors = [];
  const title = String(form.title || "").trim();
  const description = String(form.description || "").trim();
  const startNodeId = String(form.startNodeId || "").trim();

  if (!title) errors.push("Title is required");

  const nodes = [];
  const seen = new Set();

  (form.nodes || []).forEach((node, index) => {
    const label = `Node ${index + 1}`;
    const nodeKey = String(node.nodeKey || "").trim();
    if (!nodeKey) {
      errors.push(`${label}: node key is required`);
      return;
    }
    if (seen.has(nodeKey)) {
      errors.push(`${label}: node key must be unique`);
      return;
    }
    seen.add(nodeKey);

    const type = node.type;
    if (!NODE_TYPES.includes(type)) {
      errors.push(`${label}: unsupported node type "${type}"`);
      return;
    }

    const config = cleanConfigForType(type, node.config);
    const configErrors = validateConfig(type, config, label);
    errors.push(...configErrors);

    const positionX = parseNumber(node.positionX ?? node.position?.x);
    const positionY = parseNumber(node.positionY ?? node.position?.y);

    nodes.push({
      nodeKey,
      type,
      label: String(node.label || "").trim() || null,
      ...(config ? { config } : {}),
      ...(Number.isFinite(positionX) ? { positionX } : {}),
      ...(Number.isFinite(positionY) ? { positionY } : {}),
    });
  });

  if (nodes.length === 0) {
    errors.push("At least one node is required");
  }

  if (startNodeId && !seen.has(startNodeId)) {
    errors.push("Start node must match one of the defined node keys");
  }

  const edges = [];
  const edgeKeys = new Set();
  const allEdges = Array.isArray(form.edges) ? form.edges : [];

  allEdges.forEach((edge, index) => {
    const label = `Edge ${index + 1}`;
    let edgeKey = String(edge.edgeKey || "").trim();
    if (!edgeKey) {
      edgeKey = globalThis.crypto.randomUUID();
    }
    if (edgeKeys.has(edgeKey)) {
      errors.push(`${label}: edge key must be unique`);
      return;
    }
    edgeKeys.add(edgeKey);

    const sourceKey = String(edge.sourceKey || edge.source || "").trim();
    if (!sourceKey) {
      errors.push(`${label}: source node key is required`);
      return;
    }

    const targetKeyRaw = String(
      edge.targetKey || edge.target || edge.to || "",
    ).trim();
    const targetKey = targetKeyRaw || "";

    if (!seen.has(sourceKey)) {
      errors.push(`${label}: source node "${sourceKey}" does not exist`);
      return;
    }

    if (targetKey && !seen.has(targetKey)) {
      errors.push(`${label}: target node "${targetKey}" does not exist`);
      return;
    }

    const condition =
      edge.condition && typeof edge.condition === "object"
        ? deepClean(edge.condition)
        : null;

    const metadata =
      edge.metadata && typeof edge.metadata === "object"
        ? deepClean(edge.metadata)
        : null;

    let priority = null;
    if (typeof edge.priority === "number" && Number.isFinite(edge.priority)) {
      priority = edge.priority;
    } else {
      priority = index;
    }

    edges.push({
      edgeKey,
      sourceKey,
      targetKey: targetKey || null,
      label: String(edge.label || "").trim() || null,
      ...(condition ? { condition } : {}),
      ...(metadata ? { metadata } : {}),
      ...(priority !== null ? { priority } : {}),
    });
  });

  const { streams: normalizedStreams, errors: streamErrors } =
    normalizeStreamPayload(form.streams ?? [], nodes);
  errors.push(...streamErrors);

  const nodeKeys = nodes.map((node) => node.nodeKey).filter(Boolean);
  if (hasCycle(nodeKeys, edges)) {
    errors.push("Workflow cannot contain loops or cyclic branches.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    title,
    description: description || null,
    startNodeId: startNodeId || null,
    nodes,
    edges,
    streams: normalizedStreams,
  };
}

function generateLocalId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function normalizeStreamPayload(streamInputs = [], nodes = []) {
  const errors = [];
  const streams = [];
  const nodesByKey = new Map(nodes.map((node) => [node.nodeKey, node]));
  const coverageByNode = new Map();

  (streamInputs || []).forEach((stream, index) => {
    if (!stream || typeof stream !== "object") {
      return;
    }
    const sourceKey = String(
      stream.sourceKey ?? stream.fromNodeId ?? "",
    ).trim();
    const targetKey = String(stream.targetKey ?? stream.toNodeId ?? "").trim();
    if (!sourceKey || !targetKey) {
      errors.push(
        `Stream ${index + 1}: source node and target node are required`,
      );
      return;
    }
    if (sourceKey === targetKey) {
      errors.push(
        `Stream ${index + 1}: source and target cannot reference the same node "${sourceKey}"`,
      );
      return;
    }
    const sourceNode = nodesByKey.get(sourceKey);
    const targetNode = nodesByKey.get(targetKey);
    if (!sourceNode) {
      errors.push(
        `Stream ${index + 1}: unknown source node "${sourceKey}" referenced`,
      );
      return;
    }
    if (!targetNode) {
      errors.push(
        `Stream ${index + 1}: unknown target node "${targetKey}" referenced`,
      );
      return;
    }
    const coverage = coverageByNode.get(targetKey) ?? new Set();
    if (coverage.has(sourceKey)) {
      errors.push(
        `Node "${targetKey}" already consumes data from "${sourceKey}"`,
      );
      return;
    }
    coverage.add(sourceKey);
    coverageByNode.set(targetKey, coverage);
    const streamId =
      typeof stream.streamKey === "string" && stream.streamKey.trim()
        ? stream.streamKey.trim()
        : typeof stream.id === "string" && stream.id.trim()
          ? stream.id.trim()
          : generateLocalId(`stream_${index + 1}`);
    streams.push({
      id: streamId,
      fromNodeId: sourceKey,
      toNodeId: targetKey,
    });
  });

  return { streams, errors };
}

export function formatApiError(payload) {
  if (!payload || typeof payload !== "object") {
    return "Failed to save workflow";
  }
  const segments = [];
  if (typeof payload.error === "string" && payload.error) {
    segments.push(payload.error);
  }
  if (Array.isArray(payload.details) && payload.details.length > 0) {
    segments.push(payload.details.join("\n"));
  } else if (typeof payload.message === "string" && payload.message) {
    segments.push(payload.message);
  }
  return segments.length > 0 ? segments.join("\n") : "Failed to save workflow";
}

function hasCycle(nodeKeys, edges) {
  if (nodeKeys.length === 0) return false;
  const adjacency = new Map(nodeKeys.map((key) => [key, []]));
  edges.forEach((edge) => {
    if (!edge || !edge.sourceKey || !edge.targetKey) return;
    if (!adjacency.has(edge.sourceKey) || !adjacency.has(edge.targetKey))
      return;
    adjacency.get(edge.sourceKey).push(edge.targetKey);
  });
  const visiting = new Set();
  const visited = new Set();

  const dfs = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    const neighbors = adjacency.get(node) ?? [];
    for (const next of neighbors) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of nodeKeys) {
    if (dfs(node)) {
      return true;
    }
  }
  return false;
}

function cleanConfigForType(_type, config) {
  if (!config || typeof config !== "object") {
    return null;
  }
  const cleaned = deepClean(config);
  return cleaned ?? null;
}

function validateConfig(type, config, label) {
  const errors = [];
  if (type === "navigate") {
    if (!config || !config.url)
      errors.push(`${label}: URL is required for navigate nodes`);
  } else if (type === "wait") {
    const timeoutValue =
      typeof config?.timeout === "number" ? config.timeout : config?.seconds;
    if (!isPositiveNumber(timeoutValue)) {
      errors.push(`${label}: Duration must be a number greater than 0 seconds`);
    }
  } else if (type === "wait_element") {
    const typeValue =
      typeof config?.type === "string"
        ? normalizeWaitElementTypeValue(config.type)
        : null;
    if (!typeValue || !WAIT_ELEMENT_CONDITION_TYPES.includes(typeValue)) {
      errors.push(
        `${label}: Element wait requires a valid state (visible or attached)`,
      );
    }
    if (!config || typeof config.xpath !== "string" || !config.xpath.trim()) {
      errors.push(`${label}: XPath is required for element waits`);
    }
    const timeoutValue = config?.timeout;
    if (!isPositiveNumber(timeoutValue)) {
      errors.push(`${label}: Condition timeout must be greater than 0 seconds`);
    }
  } else if (type === "click") {
    if (!config || !config.xpath)
      errors.push(`${label}: XPath is required for click nodes`);
    if (!config || !config.button)
      errors.push(`${label}: Button is required for click nodes`);
    else if (!CLICK_BUTTON_OPTIONS.includes(config.button)) {
      errors.push(
        `${label}: Button must be one of ${CLICK_BUTTON_OPTIONS.join(", ")}`,
      );
    }
    if (
      typeof config?.clickCount !== "number" ||
      !Number.isInteger(config.clickCount) ||
      config.clickCount <= 0
    ) {
      errors.push(
        `${label}: Click count must be an integer greater than 0 for click nodes`,
      );
    }
    if (
      typeof config?.delay !== "number" ||
      !Number.isFinite(config.delay) ||
      config.delay < 0
    ) {
      errors.push(
        `${label}: Delay must be a non-negative number for click nodes`,
      );
    }
    if (
      typeof config?.timeout !== "number" ||
      !Number.isFinite(config.timeout) ||
      config.timeout <= 0
    ) {
      errors.push(
        `${label}: Timeout must be a number greater than 0 for click nodes`,
      );
    }
  } else if (type === "fill") {
    if (!config || !config.xpath)
      errors.push(`${label}: XPath is required for fill nodes`);
    const template =
      typeof config?.value === "string" ? config.value.trim() : "";
    if (!template) {
      errors.push(`${label}: Value template is required for fill nodes`);
    }
  } else if (type === "press") {
    if (!config || !config.xpath)
      errors.push(`${label}: XPath is required for press nodes`);
    if (!config || !config.key)
      errors.push(`${label}: Key is required for press nodes`);
  } else if (type === "log") {
    if (!config || !config.message)
      errors.push(`${label}: Message is required for log nodes`);
  } else if (type === "script") {
    if (!config || !config.code)
      errors.push(`${label}: Code is required for script nodes`);
  } else if (type === "extract_text") {
    if (!config || !config.xpath)
      errors.push(`${label}: XPath is required for extract_text nodes`);
  }
  return errors;
}

export function deepClean(value) {
  if (Array.isArray(value)) {
    const items = value
      .map(deepClean)
      .filter(
        (item) =>
          item !== undefined &&
          (!(typeof item === "object") ||
            (item && Object.keys(item).length > 0)),
      );
    return items.length > 0 ? items : undefined;
  }
  if (value && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      const cleaned = deepClean(val);
      if (cleaned !== undefined) next[key] = cleaned;
    });
    return Object.keys(next).length > 0 ? next : undefined;
  }
  if (value === null || value === "" || typeof value === "undefined") {
    return undefined;
  }
  return value;
}
