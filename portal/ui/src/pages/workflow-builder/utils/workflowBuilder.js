import { BRANCH_CONDITION_TYPES, NODE_TYPES } from "../constants.js";

export function getBuilderContext(pathname) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);
  if (segments.length === 2 && segments[0] === "workflow") {
    const slug = segments[1];
    if (slug) {
      return { workflowId: decodeURIComponent(slug) };
    }
  }
  return { workflowId: null };
}

export function createEmptyNode(existingNodes) {
  const existingKeys = existingNodes.map((node) => node.nodeKey);
  const nodeKey = generateNodeKey(existingKeys);
  return {
    nodeKey,
    label: "",
    type: "navigate",
    config: getDefaultConfig("navigate"),
    successConfig: null,
  };
}

export function toEditableNode(node) {
  return {
    nodeKey: node.nodeKey ?? "",
    label: node.label ?? "",
    type: node.type ?? "navigate",
    config: node.config && typeof node.config === "object"
      ? node.config
      : getDefaultConfig(node.type ?? "navigate"),
    successConfig: node.successConfig && typeof node.successConfig === "object"
      ? node.successConfig
      : null,
  };
}

export function toEditableEdge(edge) {
  const edgeKey = String(edge.edgeKey || edge.id || "").trim();
  return {
    edgeKey,
    sourceKey: edge.sourceKey ?? edge.source ?? edge.from ?? "",
    targetKey: edge.targetKey ?? edge.target ?? edge.to ?? "",
    label: edge.label ?? "",
    condition: edge.condition && typeof edge.condition === "object" ? edge.condition : null,
    metadata: edge.metadata && typeof edge.metadata === "object" ? edge.metadata : null,
    priority: typeof edge.priority === "number" ? edge.priority : null,
  };
}

export function getDefaultConfig(type) {
  switch (type) {
    case "navigate":
      return { url: "", waitUntil: "" };
    case "scroll":
      return { dx: 0, dy: 600 };
    case "click":
      return { xpath: "", options: { button: "left", clickCount: 1 } };
    case "fill":
      return { xpath: "", value: "", clear: false };
    case "press":
      return { xpath: "", key: "", delay: null };
    case "log":
      return { target: "agent-flow", level: "info", message: "" };
    case "script":
      return { code: "", as: "" };
    case "extract_text":
      return { xpath: "", as: "" };
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

export function getBranchConditionType(condition) {
  if (!condition || typeof condition !== "object") return BRANCH_CONDITION_TYPES[0].value;
  if (condition.visible) return "visible";
  if (condition.exists) return "exists";
  if (typeof condition.urlIncludes === "string") return "urlIncludes";
  if (typeof condition.delay === "number") return "delay";
  if (condition.script) return "script";
  return BRANCH_CONDITION_TYPES[0].value;
}

export function getSuccessType(success) {
  if (!success || typeof success !== "object") return "";
  const condition = success.condition;
  if (!condition || typeof condition !== "object") return "";
  if (typeof condition.delay === "number") return "delay";
  if (condition.visible) return "visible";
  if (condition.exists) return "exists";
  if (typeof condition.urlIncludes === "string") return "urlIncludes";
  if (condition.script) return "script";
  return "";
}

export function createDefaultSuccessConfig(type) {
  switch (type) {
    case "delay":
      return { timeout: 5, condition: { delay: 1 } };
    case "visible":
      return { timeout: 5, condition: { visible: { xpath: "" } } };
    case "exists":
      return { timeout: 5, condition: { exists: { xpath: "" } } };
    case "urlIncludes":
      return { timeout: 5, condition: { urlIncludes: "" } };
    case "script":
      return { timeout: 5, condition: { script: { code: "" } } };
    default:
      return null;
  }
}

export function cleanSuccessConfig(value) {
  if (!value || typeof value !== "object") return null;
  const cleaned = deepClean(value);
  return cleaned ?? null;
}

export function parseNumber(input) {
  if (input === "" || input === null || typeof input === "undefined") return null;
  const num = Number(input);
  return Number.isFinite(num) ? num : null;
}

export function buildPayload(form) {
  const errors = [];
  const slug = String(form.slug || "").trim();
  const title = String(form.title || "").trim();
  const description = String(form.description || "").trim();
  const startNodeId = String(form.startNodeId || "").trim();

  if (!slug) errors.push("Slug is required");
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

    const successConfig = cleanSuccessConfig(node.successConfig);

    nodes.push({
      nodeKey,
      type,
      label: String(node.label || "").trim() || null,
      ...(config ? { config } : {}),
      ...(successConfig ? { successConfig } : {}),
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
      edgeKey = generateEdgeKey(edgeKeys);
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

    const targetKeyRaw = String(edge.targetKey || edge.target || edge.to || "").trim();
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

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    slug,
    title,
    description: description || null,
    startNodeId: startNodeId || null,
    nodes,
    edges,
  };
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

export function generateNodeKey(existingKeys) {
  const taken = new Set(existingKeys);
  let index = existingKeys.length + 1;
  let candidate = `node_${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `node_${index}`;
  }
  return candidate;
}

export function generateEdgeKey(existingKeys) {
  const taken = new Set(existingKeys);
  let index = taken.size + 1;
  let candidate = `edge_${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `edge_${index}`;
  }
  return candidate;
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
    if (!config || !config.url) errors.push(`${label}: URL is required for navigate nodes`);
  } else if (type === "click") {
    if (!config || !config.xpath) errors.push(`${label}: XPath is required for click nodes`);
  } else if (type === "fill") {
    if (!config || !config.xpath) errors.push(`${label}: XPath is required for fill nodes`);
    if (!config || (!config.value && config.value !== "")) errors.push(`${label}: Value is required for fill nodes`);
  } else if (type === "press") {
    if (!config || !config.xpath) errors.push(`${label}: XPath is required for press nodes`);
    if (!config || !config.key) errors.push(`${label}: Key is required for press nodes`);
  } else if (type === "log") {
    if (!config || !config.message) errors.push(`${label}: Message is required for log nodes`);
  } else if (type === "script") {
    if (!config || !config.code) errors.push(`${label}: Code is required for script nodes`);
  } else if (type === "extract_text") {
    if (!config || !config.xpath) errors.push(`${label}: XPath is required for extract_text nodes`);
    if (!config || !config.as) errors.push(`${label}: Variable name is required for extract_text nodes`);
  }
  return errors;
}

export function deepClean(value) {
  if (Array.isArray(value)) {
    const items = value
      .map(deepClean)
      .filter((item) => item !== undefined && (!(typeof item === "object") || (item && Object.keys(item).length > 0)));
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
