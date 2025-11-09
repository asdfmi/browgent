import { randomUUID } from 'node:crypto';
import { NotFoundApplicationError } from '../errors.js';
import {
  normalizeWorkflowStructure,
  serializeWorkflow,
} from '../utils/workflow-structure.js';
import { stableStringify } from '../../../domain/utils/object-utils.js';

const identity = (item) => item.id;

function diffCollections(left, right, transform = (item) => item) {
  const leftMap = new Map(left.map((item) => [identity(item), item]));
  const rightMap = new Map(right.map((item) => [identity(item), item]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, item] of rightMap.entries()) {
    if (!leftMap.has(id)) {
      added.push(transform(item));
    } else if (stableStringify(leftMap.get(id)) !== stableStringify(item)) {
      changed.push({
        before: transform(leftMap.get(id)),
        after: transform(item),
      });
    }
  }

  for (const [id, item] of leftMap.entries()) {
    if (!rightMap.has(id)) {
      removed.push(transform(item));
    }
  }

  return { added, removed, changed };
}

export default class WorkflowDefinitionService {
  constructor({
    workflowRepo,
    idGenerator = () => randomUUID(),
    logger = console,
  } = {}) {
    if (!workflowRepo) {
      throw new Error('workflowRepo is required');
    }
    this.workflowRepo = workflowRepo;
    this.idGenerator = idGenerator;
    this.logger = logger;
  }

  async createWorkflowDefinition(payload = {}) {
    const workflowId = payload.id ?? this.idGenerator();
    const structure = normalizeWorkflowStructure({
      workflowId,
      name: payload.name,
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
      dataBindings: payload.dataBindings ?? [],
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        dataBindings: structure.dataBindings,
      },
      metadata: { description: payload.description ?? null },
    });
    return this.#loadWorkflowView(workflowId);
  }

  async duplicateWorkflowDefinition(sourceWorkflowId, overrides = {}) {
    const source = await this.#loadWorkflowSnapshot(sourceWorkflowId);
    const workflowId = overrides.id ?? this.idGenerator();
    const nodeIdMap = new Map();
    const duplicatedNodes = source.definition.nodes.map((node) => {
      const newId = this.idGenerator();
      nodeIdMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
      };
    });
    const duplicatedEdges = source.definition.edges.map((edge) => ({
      ...edge,
      id: this.idGenerator(),
      workflowId,
      fromNodeId: nodeIdMap.get(edge.fromNodeId),
      toNodeId: edge.toNodeId ? nodeIdMap.get(edge.toNodeId) : null,
    }));
    const duplicatedBindings = source.definition.dataBindings.map((binding) => ({
      ...binding,
      id: this.idGenerator(),
      workflowId,
      sourceNodeId: nodeIdMap.get(binding.sourceNodeId),
      targetNodeId: nodeIdMap.get(binding.targetNodeId),
    }));
    const structure = normalizeWorkflowStructure({
      workflowId,
      name: overrides.name ?? `${source.metadata.name} Copy`,
      nodes: duplicatedNodes,
      edges: duplicatedEdges,
      dataBindings: duplicatedBindings,
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        dataBindings: structure.dataBindings,
      },
      metadata: { description: overrides.description ?? source.metadata.description ?? null },
    });
    return this.#loadWorkflowView(workflowId);
  }

  async updateWorkflowDefinition(workflowId, payload = {}) {
    const current = await this.#loadWorkflowSnapshot(workflowId);
    const structure = normalizeWorkflowStructure({
      workflowId,
      name: payload.name ?? current.metadata.name,
      nodes: payload.nodes ?? current.definition.nodes,
      edges: payload.edges ?? current.definition.edges,
      dataBindings: payload.dataBindings ?? current.definition.dataBindings,
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        dataBindings: structure.dataBindings,
      },
      metadata: { description: payload.description ?? current.metadata.description ?? null },
    });
    return this.#loadWorkflowView(workflowId);
  }

  async publishWorkflowDefinition(workflowId, { versionTag } = {}) {
    const snapshot = await this.#loadWorkflowSnapshot(workflowId);
    const publishedAt = new Date();
    const version = versionTag ?? `${workflowId}:${snapshot.metadata.updatedAt?.getTime?.() ?? publishedAt.getTime()}`;
    return {
      workflowId,
      version,
      publishedAt: publishedAt.toISOString(),
      definition: serializeWorkflow(snapshot.metadata, snapshot.definition),
    };
  }

  async diffWorkflows(leftWorkflowId, rightWorkflowId) {
    const [left, right] = await Promise.all([
      this.#loadWorkflowSnapshot(leftWorkflowId),
      this.#loadWorkflowSnapshot(rightWorkflowId),
    ]);
    return {
      workflows: {
        left: this.#toWorkflowView(left),
        right: this.#toWorkflowView(right),
      },
      nodes: diffCollections(left.definition.nodes, right.definition.nodes),
      edges: diffCollections(left.definition.edges, right.definition.edges),
      dataBindings: diffCollections(left.definition.dataBindings, right.definition.dataBindings),
    };
  }

  async listWorkflows() {
    return this.workflowRepo.listSummaries();
  }

  async getWorkflow(workflowId) {
    return this.#loadWorkflowView(workflowId);
  }

  async #loadWorkflowSnapshot(workflowId) {
    const snapshot = await this.workflowRepo.findById(workflowId);
    if (!snapshot) {
      throw new NotFoundApplicationError(`Workflow ${workflowId} was not found`);
    }
    return snapshot;
  }

  async #loadWorkflowView(workflowId) {
    const snapshot = await this.#loadWorkflowSnapshot(workflowId);
    return this.#toWorkflowView(snapshot);
  }

  #toWorkflowView(snapshot) {
    const { metadata, definition } = snapshot;
    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description ?? null,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      nodes: definition.nodes,
      edges: definition.edges,
      dataBindings: definition.dataBindings,
    };
  }
}
