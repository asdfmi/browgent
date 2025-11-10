import { WorkflowExecution } from '#domain/index.js';
import { loadWorkflowDefinition } from './workflow-loader.js';

export default class RunWorkflowUseCase {
  constructor({ runnerFactory, workflowLoader = loadWorkflowDefinition, logger = console } = {}) {
    if (typeof runnerFactory !== 'function') {
      throw new Error('runnerFactory is required');
    }
    this.runnerFactory = runnerFactory;
    this.workflowLoader = workflowLoader;
    this.logger = logger;
  }

  async execute({ runId, workflowInput }) {
    if (!runId) {
      throw new Error('runId is required');
    }
    const { workflow, startNodeId } = this.workflowLoader(workflowInput);
    const execution = new WorkflowExecution({ id: runId, workflowId: workflow.id });
    execution.start();

    const runner = this.runnerFactory({
      workflow,
      execution,
      runId,
      startNodeId,
    });

    await runner.run();
    return execution;
  }
}
