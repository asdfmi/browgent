import { InvariantViolationError, ValidationError } from '../errors.js';

const DEFAULT_LOGGER = globalThis.console ?? {};

function requireRunId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError('runId is required');
  }
  return value.trim();
}

function requireWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    throw new ValidationError('workflow is required');
  }
  return workflow;
}

export default class RunManager {
  constructor({ maxConcurrency, runWorkflow, logger = DEFAULT_LOGGER } = {}) {
    if (typeof runWorkflow !== 'function') {
      throw new ValidationError('runWorkflow is required');
    }
    this.maxConcurrency = RunManager.#normalizeConcurrency(maxConcurrency);
    this.runWorkflow = runWorkflow;
    this.logger = logger;
    this.activeRuns = 0;
  }

  static #normalizeConcurrency(value) {
    const candidate = Number(value ?? 1);
    if (!Number.isFinite(candidate) || candidate <= 0) {
      throw new ValidationError('maxConcurrency must be a positive number');
    }
    return candidate;
  }

  getMetrics() {
    return { activeRuns: this.activeRuns, maxConcurrency: this.maxConcurrency };
  }

  async enqueue({ runId, workflow }) {
    requireRunId(runId);
    requireWorkflow(workflow);
    if (this.activeRuns >= this.maxConcurrency) {
      throw new InvariantViolationError('runner busy', {
        activeRuns: this.activeRuns,
        maxConcurrency: this.maxConcurrency,
      });
    }
    this.activeRuns += 1;
    let runPromise;
    try {
      runPromise = this.runWorkflow({ runId, workflow });
    } catch (error) {
      this.activeRuns -= 1;
      throw error;
    }

    Promise.resolve(runPromise)
      .catch((error) => {
        this.logger.error?.('Workflow execution failed', error);
      })
      .finally(() => {
        this.activeRuns -= 1;
      });
  }
}
