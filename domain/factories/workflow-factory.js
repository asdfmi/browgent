import { randomUUID } from "node:crypto";
import { NotFoundError } from "../errors.js";
import {
  normalizeWorkflowStructure,
  serializeWorkflow,
} from "../utils/workflow-structure.js";

export default class WorkflowFactory {
  constructor({ workflowRepo, idGenerator = () => randomUUID() } = {}) {
    if (!workflowRepo) {
      throw new Error("workflowRepo is required");
    }
    this.workflowRepo = workflowRepo;
    this.idGenerator = idGenerator;
  }

  async createWorkflowDefinition(payload = {}) {
    const workflowId = payload.id ?? this.idGenerator();
    const structure = normalizeWorkflowStructure({
      workflowId,
      name: payload.name,
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
      streams: payload.streams ?? [],
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        streams: structure.streams,
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
    const duplicatedStreams = source.definition.streams.map(
      (stream) => ({
        ...stream,
        id: this.idGenerator(),
        workflowId,
        sourceNodeId: nodeIdMap.get(stream.sourceNodeId),
        targetNodeId: nodeIdMap.get(stream.targetNodeId),
      }),
    );
    const structure = normalizeWorkflowStructure({
      workflowId,
      name: overrides.name ?? `${source.metadata.name} Copy`,
      nodes: duplicatedNodes,
      edges: duplicatedEdges,
      streams: duplicatedStreams,
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        streams: structure.streams,
      },
      metadata: {
        description:
          overrides.description ?? source.metadata.description ?? null,
      },
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
      streams: payload.streams ?? current.definition.streams,
    });
    await this.workflowRepo.save({
      workflow: structure.workflow,
      definition: {
        nodes: structure.nodes,
        edges: structure.edges,
        streams: structure.streams,
      },
      metadata: {
        description:
          payload.description ?? current.metadata.description ?? null,
      },
    });
    return this.#loadWorkflowView(workflowId);
  }

  async publishWorkflowDefinition(workflowId, { versionTag } = {}) {
    const snapshot = await this.#loadWorkflowSnapshot(workflowId);
    const publishedAt = new Date();
    const version =
      versionTag ??
      `${workflowId}:${snapshot.metadata.updatedAt?.getTime?.() ?? publishedAt.getTime()}`;
    return {
      workflowId,
      version,
      publishedAt: publishedAt.toISOString(),
      definition: serializeWorkflow(snapshot.metadata, snapshot.definition),
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
      throw new NotFoundError(`Workflow ${workflowId} was not found`);
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
      streams: definition.streams,
    };
  }
}
