import { ValidationError } from '#domain/errors.js';
import { randomUUID } from 'node:crypto';

export default class WorkflowController {
  constructor({ workflowFactory, workflowExecutionService }) {
    this.workflowFactory = workflowFactory;
    this.workflowExecutionService = workflowExecutionService;

    this.listWorkflows = this.listWorkflows.bind(this);
    this.createDraftWorkflow = this.createDraftWorkflow.bind(this);
    this.getWorkflow = this.getWorkflow.bind(this);
    this.updateWorkflow = this.updateWorkflow.bind(this);
    this.listRuns = this.listRuns.bind(this);
    this.runWorkflow = this.runWorkflow.bind(this);
  }

  async listWorkflows(_req, res) {
    const rows = await this.workflowFactory.listWorkflows();
    res.json({ data: rows.map(formatWorkflowSummary) });
  }

  async createDraftWorkflow(req, res) {
    const workflowId = randomUUID();
    const basePayload = {
      title: req.body?.title || 'Untitled Workflow',
      description: req.body?.description || '',
      startNodeId: 'node_1',
      nodes: [
        {
          nodeKey: 'node_1',
          label: 'Navigate',
          type: 'navigate',
          config: { url: '', waitUntil: '' },
        },
      ],
      edges: [],
    };
    const definitionInput = buildDefinitionPayload(workflowId, basePayload);
    const created = await this.workflowFactory.createWorkflowDefinition(definitionInput);
    res.status(201).json({ data: formatWorkflowDetail(created) });
  }

  async getWorkflow(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({ error: 'invalid_workflow', message: 'workflow id is required' });
      return;
    }
    const workflow = await this.workflowFactory.getWorkflow(workflowId);
    res.json({ data: formatWorkflowDetail(workflow) });
  }

  async updateWorkflow(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({ error: 'invalid_workflow', message: 'workflow id is required' });
      return;
    }
    const definitionInput = buildDefinitionPayload(workflowId, req.body || {});
    const updated = await this.workflowFactory.updateWorkflowDefinition(workflowId, {
      name: definitionInput.name,
      description: definitionInput.description,
      nodes: definitionInput.nodes,
      edges: definitionInput.edges,
      dataBindings: definitionInput.dataBindings,
    });
    res.json({ data: formatWorkflowDetail(updated) });
  }

  async listRuns(req, res) {
    const workflowId = sanitizeWorkflowId(req.params.workflowId);
    if (!workflowId) {
      res.status(400).json({ error: 'invalid_workflow', message: 'workflow id is required' });
      return;
    }
    const runs = await this.workflowExecutionService.listExecutions();
    const filtered = runs.filter((run) => run.workflowId === workflowId).map(formatRunSummary);
    res.json({ data: filtered });
  }

  async runWorkflow(_req, res) {
    res.status(501).json({ error: 'not_implemented', message: 'Runner integration is not available yet.' });
  }
}

function sanitizeWorkflowId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function buildDefinitionPayload(workflowId, payload) {
  const title = String(payload.title ?? payload.name ?? '').trim();
  if (!title) {
    throw new ValidationError('title is required');
  }
  const nodes = convertBuilderNodes(payload.nodes);
  if (nodes.length === 0) {
    throw new ValidationError('At least one node is required');
  }
  const edges = convertBuilderEdges(payload.edges);
  return {
    id: workflowId,
    name: title,
    description: typeof payload.description === 'string' ? payload.description : null,
    nodes,
    edges,
    dataBindings: Array.isArray(payload.dataBindings) ? payload.dataBindings : [],
  };
}

function convertBuilderNodes(nodesInput = []) {
  return nodesInput.map((node, index) => {
    const candidate = String(node?.nodeKey || node?.id || `node_${index + 1}`).trim();
    if (!candidate) {
      throw new ValidationError(`Node ${index + 1}: node key is required`);
    }
    return {
      id: candidate,
      nodeKey: candidate,
      name: (typeof node?.label === 'string' && node.label.trim()) ? node.label.trim() : candidate,
      type: node?.type || 'navigate',
      inputs: Array.isArray(node?.inputs) ? node.inputs : [],
      outputs: Array.isArray(node?.outputs) ? node.outputs : [],
      config: node?.config ?? null,
    };
  });
}

function convertBuilderEdges(edgesInput = []) {
  return edgesInput.map((edge, index) => {
    const edgeId = String(edge?.edgeKey || edge?.id || `edge_${index + 1}`).trim();
    const from = String(edge?.sourceKey || edge?.source || edge?.from || '').trim();
    if (!from) {
      throw new ValidationError(`Edge ${index + 1}: source node is required`);
    }
    const toRaw = edge?.targetKey ?? edge?.target ?? edge?.to ?? null;
    const to = typeof toRaw === 'string' ? toRaw.trim() : null;
    return {
      id: edgeId,
      from,
      to: to || null,
      label: typeof edge?.label === 'string' ? edge.label : null,
      condition: edge?.condition && typeof edge.condition === 'object' ? edge.condition : null,
      metadata: edge?.metadata && typeof edge.metadata === 'object' ? edge.metadata : null,
      priority: typeof edge?.priority === 'number' ? edge.priority : index,
    };
  });
}

function formatWorkflowSummary(row) {
  return {
    id: row.id,
    title: row.name,
    description: row.description ?? '',
    createdAt: toISO(row.createdAt),
    updatedAt: toISO(row.updatedAt),
  };
}

function formatWorkflowDetail(view) {
  const nodes = Array.isArray(view.nodes) ? view.nodes.map(toBuilderNode) : [];
  const edges = Array.isArray(view.edges) ? view.edges.map(toBuilderEdge) : [];
  return {
    id: view.id,
    title: view.name ?? '',
    description: view.description ?? '',
    startNodeId: view.startNodeId ?? (nodes[0]?.nodeKey ?? ''),
    nodes,
    edges,
    createdAt: toISO(view.createdAt),
    updatedAt: toISO(view.updatedAt),
  };
}

function toBuilderNode(node, index) {
  const key = String(node?.nodeKey || node?.id || `node_${index + 1}`).trim();
  return {
    nodeKey: key,
    label: (typeof node?.label === 'string' && node.label.trim())
      ? node.label.trim()
      : (typeof node?.name === 'string' && node.name.trim())
        ? node.name.trim()
        : key,
    type: node?.type || 'navigate',
    config: node?.config ?? {},
  };
}

function toBuilderEdge(edge, index) {
  return {
    edgeKey: String(edge?.edgeKey || edge?.id || `edge_${index + 1}`).trim(),
    sourceKey: String(edge?.sourceKey || edge?.fromNodeId || edge?.from || edge?.source || '').trim(),
    targetKey: edge?.targetKey
      ? String(edge.targetKey).trim()
      : edge?.toNodeId
        ? String(edge.toNodeId).trim()
        : edge?.to
          ? String(edge.to).trim()
          : '',
    label: edge?.label ?? '',
    condition: edge?.condition ?? null,
    metadata: edge?.metadata ?? null,
    priority: typeof edge?.priority === 'number' ? edge.priority : null,
  };
}

function formatRunSummary(run) {
  return {
    id: run.id,
    runKey: run.id,
    status: (run.status || '').toLowerCase(),
    startedAt: toISO(run.startedAt),
    finishedAt: toISO(run.completedAt ?? run.updatedAt),
    errorMessage: run.result?.error ?? null,
  };
}

function toISO(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
