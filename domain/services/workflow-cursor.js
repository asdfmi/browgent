import WorkflowPlan from './workflow-plan.js';
import { InvariantViolationError } from '../errors.js';

export default class WorkflowCursor {
  constructor({ workflow, preferredStartNodeId = null } = {}) {
    this.plan = new WorkflowPlan({ workflow, preferredStartNodeId });
    this.currentStepId = this.plan.getStartNodeId();
  }

  getCurrentStep() {
    return this.currentStepId ? this.plan.getStep(this.currentStepId) : null;
  }

  isFinished() {
    return !this.currentStepId;
  }

  advance({ requestedNextId } = {}) {
    const nextId = this.#determineNextId(requestedNextId);
    this.currentStepId = nextId;
    return this.getCurrentStep();
  }

  #determineNextId(requestedNextId) {
    let candidate = this.#normalizeId(requestedNextId);
    if (candidate) {
      if (!this.plan.hasStep(candidate)) {
        throw new InvariantViolationError(`Node ${candidate} not found in workflow ${this.plan.workflow.id}`);
      }
      return candidate;
    }
    candidate = this.plan.getFirstEdgeTarget(this.currentStepId);
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
}
