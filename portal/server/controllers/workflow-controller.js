import { ValidationError } from "@agent-flow/domain/errors.js";
import { randomUUID } from "node:crypto";

export default class WorkflowController {
  constructor({ workflowFactory, runnerClient }) {
    this.workflowFactory = workflowFactory;
    this.runnerClient = runnerClient;

    this.listWorkflows = this.listWorkflows.bind(this);
    this.createWorkflow = this.createWorkflow.bind(this);
    this.getWorkflow = this.getWorkflow.bind(this);
    this.updateWorkflow = this.updateWorkflow.bind(this);
    this.listRuns = this.listRuns.bind(this);
    this.runWorkflow = this.runWorkflow.bind(this);
  }

  async listWorkflows(_req, res) {
    const rows = await this.workflowFactory.listWorkflows();
    res.json({ data: rows.map(formatWorkflowSummary) });
  }

  async createWorkflow(req, res) {
    const workflowId = randomUUID();
    const definitionInput = buildDefinitionPayload(workflowId, req.body || {});
    const created =
      await this.workflowFactory.createWorkflowDefinition(definitionInput);
    res.status(201).json({ data: formatWorkflowDetail(created) });
  }

  async getWorkflow(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({
        error: "invalid_workflow",
        message: "workflow id is required",
      });
      return;
    }
    const workflow = await this.workflowFactory.getWorkflow(workflowId);
    res.json({ data: formatWorkflowDetail(workflow) });
  }

  async updateWorkflow(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({
        error: "invalid_workflow",
        message: "workflow id is required",
      });
      return;
    }
    const definitionInput = buildDefinitionPayload(workflowId, req.body || {});
    const updated = await this.workflowFactory.updateWorkflowDefinition(
      workflowId,
      {
        name: definitionInput.name,
        description: definitionInput.description,
        nodes: definitionInput.nodes,
        edges: definitionInput.edges,
        streams: definitionInput.streams,
      },
    );
    res.json({ data: formatWorkflowDetail(updated) });
  }

  async listRuns(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({
        error: "invalid_workflow",
        message: "workflow id is required",
      });
      return;
    }
    res.json({ data: [] });
  }

  async runWorkflow(req, res) {
    if (!this.runnerClient) {
      res.status(503).json({
        error: "runner_unavailable",
        message: "Runner integration is not configured",
      });
      return;
    }
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({
        error: "invalid_workflow",
        message: "workflow id is required",
      });
      return;
    }
    const startNodeId = sanitizeWorkflowId(req.body?.startNodeId);
    const runId = randomUUID();
    const publication =
      await this.workflowFactory.publishWorkflowDefinition(workflowId);
    const workflowPayload = {
      id: publication.definition.id,
      name: publication.definition.name,
      description: publication.definition.description,
      nodes: publication.definition.nodes,
      edges: publication.definition.edges,
      streams: publication.definition.streams,
    };
    await this.runnerClient.triggerRun({
      runId,
      workflow: workflowPayload,
      startNodeId,
    });
    res.status(202).json({ runId });
  }
}

function sanitizeWorkflowId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function buildDefinitionPayload(workflowId, payload) {
  const title = String(payload.title ?? payload.name ?? "").trim();
  if (!title) {
    throw new ValidationError("title is required");
  }
  const nodes = convertBuilderNodes(payload.nodes);
  if (nodes.length === 0) {
    throw new ValidationError("At least one node is required");
  }
  const edges = convertBuilderEdges(payload.edges);
  return {
    id: workflowId,
    name: title,
    description:
      typeof payload.description === "string" ? payload.description : null,
    nodes,
    edges,
    streams: Array.isArray(payload.streams) ? payload.streams : [],
  };
}

function convertBuilderNodes(nodesInput = []) {
  return nodesInput.map((node, index) => {
    const candidate = String(
      node?.nodeKey || node?.id || `node_${index + 1}`,
    ).trim();
    if (!candidate) {
      throw new ValidationError(`Node ${index + 1}: node key is required`);
    }
    const { positionX, positionY } = normalizePosition(node);
    return {
      id: candidate,
      nodeKey: candidate,
      name:
        typeof node?.label === "string" && node.label.trim()
          ? node.label.trim()
          : candidate,
      type: node?.type || "navigate",
      config: node?.config ?? null,
      positionX,
      positionY,
    };
  });
}

function convertBuilderEdges(edgesInput = []) {
  return edgesInput.map((edge, index) => {
    const edgeId = String(
      edge?.edgeKey || edge?.id || `edge_${index + 1}`,
    ).trim();
    const from = String(
      edge?.sourceKey || edge?.source || edge?.from || "",
    ).trim();
    if (!from) {
      throw new ValidationError(`Edge ${index + 1}: source node is required`);
    }
    const toRaw = edge?.targetKey ?? edge?.target ?? edge?.to ?? null;
    const to = typeof toRaw === "string" ? toRaw.trim() : null;
    return {
      id: edgeId,
      from,
      to: to || null,
      label: typeof edge?.label === "string" ? edge.label : null,
      condition:
        edge?.condition && typeof edge.condition === "object"
          ? edge.condition
          : null,
      metadata:
        edge?.metadata && typeof edge.metadata === "object"
          ? edge.metadata
          : null,
      priority: typeof edge?.priority === "number" ? edge.priority : index,
    };
  });
}

function normalizePosition(node) {
  const px = toFiniteNumber(
    node?.positionX ??
      node?.position?.x ??
      node?.position?.left ??
      node?.x ??
      node?.left,
  );
  const py = toFiniteNumber(
    node?.positionY ??
      node?.position?.y ??
      node?.position?.top ??
      node?.y ??
      node?.top,
  );
  return { positionX: px, positionY: py };
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatWorkflowSummary(row) {
  return {
    id: row.id,
    title: row.name,
    description: row.description ?? "",
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  };
}

function formatWorkflowDetail(view) {
  const nodes = Array.isArray(view.nodes) ? view.nodes.map(toBuilderNode) : [];
  const edges = Array.isArray(view.edges) ? view.edges.map(toBuilderEdge) : [];
  const streams = Array.isArray(view.streams)
    ? view.streams.map(toBuilderStream)
    : [];
  return {
    id: view.id,
    title: view.name ?? "",
    description: view.description ?? "",
    startNodeId: view.startNodeId ?? nodes[0]?.nodeKey ?? "",
    nodes,
    edges,
    streams,
    createdAt: toISO(view.createdAt),
    updatedAt: toISO(view.updatedAt),
  };
}

function toBuilderNode(node, index) {
  const key = String(node?.nodeKey || node?.id || `node_${index + 1}`).trim();
  const { positionX, positionY } = normalizePosition(node);
  return {
    nodeKey: key,
    label:
      typeof node?.label === "string" && node.label.trim()
        ? node.label.trim()
        : typeof node?.name === "string" && node.name.trim()
          ? node.name.trim()
          : key,
    type: node?.type || "navigate",
    config: node?.config ?? {},
    positionX,
    positionY,
  };
}

function toBuilderEdge(edge, index) {
  return {
    edgeKey: String(edge?.edgeKey || edge?.id || `edge_${index + 1}`).trim(),
    sourceKey: String(
      edge?.sourceKey || edge?.fromNodeId || edge?.from || edge?.source || "",
    ).trim(),
    targetKey: edge?.targetKey
      ? String(edge.targetKey).trim()
      : edge?.toNodeId
        ? String(edge.toNodeId).trim()
        : edge?.to
          ? String(edge.to).trim()
          : "",
    label: edge?.label ?? "",
    condition: edge?.condition ?? null,
    metadata: edge?.metadata ?? null,
    priority: typeof edge?.priority === "number" ? edge.priority : null,
  };
}

function toBuilderStream(stream, index) {
  return {
    streamKey: String(
      stream?.streamKey || stream?.id || `stream_${index + 1}`,
    ).trim(),
    sourceKey: String(stream?.sourceKey || stream?.fromNodeId || "").trim(),
    targetKey: String(stream?.targetKey || stream?.toNodeId || "").trim(),
  };
}

function toISO(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
