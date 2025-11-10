import WorkflowExecution from '../aggregates/workflow-execution.js';
import { requireNonEmptyString } from '../utils/validation.js';
import { loadWorkflowDefinition } from './workflow-loader.js';

const DEFAULT_LOGGER = globalThis.console ?? {};

export default class RunWorkflowUseCase {
  constructor({ runnerFactory, workflowLoader = loadWorkflowDefinition, logger = DEFAULT_LOGGER } = {}) {
    if (typeof runnerFactory !== 'function') {
      throw new Error('runnerFactory is required');
    }
    this.runnerFactory = runnerFactory;
    this.workflowLoader = workflowLoader;
    this.logger = logger;
  }

  async execute({ runId, workflowInput }) {
    const normalizedRunId = requireNonEmptyString(runId, 'runId');
    const { workflow, startNodeId } = this.workflowLoader(workflowInput);
    const execution = new WorkflowExecution({
      id: normalizedRunId,
      workflowId: workflow.id,
      expectedNodeIds: workflow.getNodes().map((node) => node.id),
    });
    execution.start();

    const runner = this.runnerFactory({
      workflow,
      execution,
      runId: normalizedRunId,
      startNodeId,
    });

    await runner.run();
    return execution;
  }
}
