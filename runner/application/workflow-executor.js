import { WorkflowCursor } from '#domain/index.js';
import ExecutionContext from './execution-context.js';
import { buildExecutionView } from './execution-view.js';

export default class WorkflowExecutor {
  constructor({
    workflow,
    execution,
    runId,
    logger = console,
    startNodeId = null,
    browserSessionFactory,
    eventDispatcherFactory,
    stepHandlers = {},
    eventPublisher = null,
  }) {
    if (typeof browserSessionFactory !== 'function') {
      throw new Error('browserSessionFactory is required');
    }
    if (typeof eventDispatcherFactory !== 'function') {
      throw new Error('eventDispatcherFactory is required');
    }
    this.workflow = workflow;
    this.workflowExecution = execution;
    this.runId = runId;
    this.logger = logger;
    this.startNodeId = startNodeId;
    this.execution = new ExecutionContext();
    this.browserSessionFactory = browserSessionFactory;
    this.eventDispatcherFactory = eventDispatcherFactory;
    this.stepHandlers = stepHandlers;
    this.eventPublisher = eventPublisher;
    this.browserSession = null;
    this.events = null;
    this.cursor = null;
  }

  async run() {
    this.browserSession = await this.browserSessionFactory({ logger: this.logger }).init();
    this.events = this.eventDispatcherFactory({ runId: this.runId, logger: this.logger, publish: this.eventPublisher }) ?? null;
    this.events?.attachBrowserSession(this.browserSession);
    this.events?.startScreenshotStream();
    this.cursor = new WorkflowCursor({ workflow: this.workflow, preferredStartNodeId: this.startNodeId });

    await this.#emitRunStatus('running');
    try {
      await this.#runSteps();
      await this.#emitRunStatus('succeeded');
      await this.events?.done({ ok: true, execution: this.#executionSnapshot() });
    } catch (error) {
      const message = String(error?.message || error);
      await this.#emitRunStatus('failed', { error: message });
      await this.events?.done({ ok: false, error: message, execution: this.#executionSnapshot() });
      throw error;
    } finally {
      this.events?.stopScreenshotStream();
      await this.browserSession?.cleanup();
    }
  }

  async #runSteps() {
    let step = this.cursor.getCurrentStep();
    while (step) {
      const nextStepId = await this.#executeStep(step, { stepId: step.id });
      step = this.cursor.advance({ requestedNextId: nextStepId });
    }
  }

  async #executeStep(step, meta) {
    if (!step || typeof step.type !== 'string') {
      throw new Error(`invalid step: ${JSON.stringify(step)}`);
    }
    const index = this.execution.nextStepIndex();
    const enrichedMeta = {
      ...meta,
      type: step.type,
      stepId: step.id ?? meta?.stepId,
      name: step.name ?? null,
    };
    if (this.events?.stepStart) {
      await this.events.stepStart({ index, meta: enrichedMeta });
    }
    this.workflowExecution.startNode(step.id);
    try {
      const handler = this.stepHandlers[step.type];
      if (!handler) {
        throw new Error(`unsupported step type: ${step.type}`);
      }
      const result = await handler({
        automation: this.browserSession,
        execution: this.execution,
        step,
        meta: enrichedMeta,
        index,
        runId: this.runId,
        publishEvent: this.eventPublisher,
        logger: this.logger,
      });
      const { requestedNextId, outputs } = this.#interpretHandlerResult(result);
      this.workflowExecution.completeNode(step.id, { outputs: outputs ?? null });
      if (this.events?.stepEnd) {
        await this.events.stepEnd({ index, ok: true, meta: enrichedMeta });
      }
      return requestedNextId;
    } catch (error) {
      const message = String(error?.message || error);
      try {
        this.workflowExecution.failNode(step.id, { error: message });
      } catch (executionError) {
        this.logger.warn?.('Failed to record node failure', executionError);
      }
      if (this.events?.stepEnd) {
        await this.events.stepEnd({ index, ok: false, error: message, meta: enrichedMeta });
      }
      throw error;
    }
  }

  #executionSnapshot() {
    return buildExecutionView(this.workflowExecution);
  }

  async #emitRunStatus(status, extra = {}) {
    await this.events?.runStatus(status, { execution: this.#executionSnapshot(), ...extra });
  }

  #interpretHandlerResult(result) {
    if (!result) {
      return { requestedNextId: undefined, outputs: null };
    }
    if (typeof result === 'object') {
      const requestedNextId = typeof result.nextStepId === 'string' ? result.nextStepId : undefined;
      const outputs = 'outputs' in result ? result.outputs : null;
      return { requestedNextId, outputs };
    }
    if (typeof result === 'string') {
      return { requestedNextId: result, outputs: null };
    }
    return { requestedNextId: undefined, outputs: result };
  }
}
