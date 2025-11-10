import WorkflowPlan from './workflow-plan.js';
import { InvariantViolationError } from '../errors.js';

export default class WorkflowCursor {
  constructor({ workflow, preferredStartNodeId = null, edgeEvaluator = null } = {}) {
    this.plan = new WorkflowPlan({ workflow, preferredStartNodeId });
    this.currentStepId = this.plan.getStartNodeId();
    this.edgeEvaluator = edgeEvaluator ?? WorkflowCursor.#defaultEdgeEvaluator;
  }

  getCurrentStep() {
    return this.currentStepId ? this.plan.getStep(this.currentStepId) : null;
  }

  isFinished() {
    return !this.currentStepId;
  }

  async advance({ requestedNextId, context } = {}) {
    const nextId = await this.#determineNextId(requestedNextId, context);
    this.currentStepId = nextId;
    return this.getCurrentStep();
  }

  async #determineNextId(requestedNextId, context) {
    let candidate = this.#normalizeId(requestedNextId);
    if (candidate) {
      if (!this.plan.hasStep(candidate)) {
        throw new InvariantViolationError(`Node ${candidate} not found in workflow ${this.plan.workflow.id}`);
      }
      return candidate;
    }
    candidate = await this.#pickEdgeTarget(this.currentStepId, context);
    if (candidate) {
      return candidate;
    }
    return this.plan.getNextStepId(this.currentStepId);
  }

  #normalizeId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed || '';
  }

  async #pickEdgeTarget(stepId, context) {
    if (!stepId) return null;
    const edges = this.plan.getEdges(stepId);
    if (edges.length === 0) {
      return null;
    }
    for (const edge of edges) {
      const allowed = await this.edgeEvaluator({
        edge,
        fromStepId: stepId,
        plan: this.plan,
        context,
      });
      if (allowed) {
        if (!edge.to) {
          throw new InvariantViolationError(`Edge ${edge.id} is missing target`);
        }
        return edge.to;
      }
    }
    return null;
  }

  static async #defaultEdgeEvaluator({ edge }) {
    return edge.condition === null;
  }
}
