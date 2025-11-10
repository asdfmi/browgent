import { InvariantViolationError } from '../errors.js';

const MAX_PRIORITY = Number.MAX_SAFE_INTEGER;

export default class WorkflowPlan {
  constructor({ workflow, preferredStartNodeId = null } = {}) {
    if (!workflow) {
      throw new InvariantViolationError('workflow is required to build execution plan');
    }
    this.workflow = workflow;
    this.nodes = workflow.getNodes();
    if (this.nodes.length === 0) {
      throw new InvariantViolationError('workflow must have at least one node to build plan');
    }
    this.stepEntries = this.nodes.map((node, index) => ({
      id: node.id,
      index,
      step: this.#toStep(node),
    }));
    this.stepById = new Map(this.stepEntries.map((entry) => [entry.id, entry]));
    this.startNodeId = this.#resolveStartNodeId(preferredStartNodeId);
  }

  getStartNodeId() {
    return this.startNodeId;
  }

  hasStep(stepId) {
    return this.stepById.has(stepId);
  }

  getStep(stepId) {
    const entry = this.stepById.get(stepId);
    if (!entry) {
      throw new InvariantViolationError(`Node ${stepId} not found in workflow ${this.workflow.id}`);
    }
    return entry.step;
  }

  getStepEntry(stepId) {
    const entry = this.stepById.get(stepId);
    if (!entry) {
      throw new InvariantViolationError(`Node ${stepId} not found in workflow ${this.workflow.id}`);
    }
    return entry;
  }

  getNextStepId(stepId) {
    const entry = this.stepById.get(stepId);
    if (!entry) return null;
    const fallback = this.stepEntries[entry.index + 1];
    return fallback ? fallback.id : null;
  }

  getEdges(stepId) {
    const edges = this.workflow.getOutgoingEdges(stepId);
    if (!edges || edges.length === 0) {
      return [];
    }
    return [...edges]
      .map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        condition: edge.condition ?? null,
        priority: typeof edge.priority === 'number' ? edge.priority : null,
      }))
      .sort((a, b) => (a.priority ?? MAX_PRIORITY) - (b.priority ?? MAX_PRIORITY));
  }

  getFirstEdgeTarget(stepId) {
    const edge = this.getEdges(stepId)[0];
    return edge?.to ?? null;
  }

  #resolveStartNodeId(preferred) {
    if (preferred && this.stepById.has(preferred)) {
      return preferred;
    }
    const candidates = this.workflow.getStartNodes();
    if (candidates.length > 0) {
      return candidates[0].id;
    }
    return this.stepEntries[0].id;
  }

  #toStep(node) {
    const base = node.toExecutionStep();
    return {
      ...base,
      success: base.config?.success ?? null,
    };
  }
}
