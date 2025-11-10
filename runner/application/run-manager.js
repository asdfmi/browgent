import RequestError from './request-error.js';

export default class RunManager {
  constructor({ maxConcurrency, runWorkflow, logger = console } = {}) {
    if (typeof runWorkflow !== 'function') {
      throw new Error('runWorkflow is required');
    }
    this.maxConcurrency = Number(maxConcurrency ?? 1);
    this.runWorkflow = runWorkflow;
    this.logger = logger;
    this.activeRuns = 0;
  }

  getMetrics() {
    return { activeRuns: this.activeRuns, maxConcurrency: this.maxConcurrency };
  }

  async enqueue({ runId, workflow }) {
    if (!workflow || typeof workflow !== 'object') {
      throw new RequestError(400, { error: 'workflow_required' });
    }

    if (!runId) {
      throw new RequestError(400, { error: 'runId required' });
    }

    if (this.activeRuns >= this.maxConcurrency) {
      throw new RequestError(429, { error: 'runner busy', active: this.activeRuns, max: this.maxConcurrency });
    }
    this.activeRuns += 1;
    let runPromise;
    try {
      runPromise = this.runWorkflow({ runId, workflow });
    } catch (error) {
      this.activeRuns -= 1;
      if (error instanceof RequestError) {
        throw error;
      }
      throw new RequestError(400, { error: 'invalid_workflow', message: error?.message || 'workflow is invalid' });
    }

    Promise.resolve(runPromise)
      .catch((error) => {
        this.logger.error('Workflow execution failed', error);
      })
      .finally(() => {
        this.activeRuns -= 1;
      });
  }
}
