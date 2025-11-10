import WorkflowCursor from './workflow-cursor.js';
import NodeRunner from './node-runner.js';
import ExecutionContext from './execution-context.js';
import { buildExecutionView } from './execution-view.js';

const DEFAULT_LOGGER = globalThis.console ?? {};

export default class WorkflowExecutor {
  constructor({
    workflow,
    execution,
    runId,
    logger = DEFAULT_LOGGER,
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
    this.nodeRunner = new NodeRunner({ handlers: stepHandlers, logger });
    this.eventPublisher = eventPublisher;
    this.browserSession = null;
    this.events = null;
    this.cursor = null;
    this.expressionCache = new Map();
  }

  async run() {
    this.browserSession = await this.browserSessionFactory({ logger: this.logger }).init();
    this.events = this.eventDispatcherFactory({ runId: this.runId, logger: this.logger, publish: this.eventPublisher }) ?? null;
    this.events?.attachBrowserSession(this.browserSession);
    this.events?.startScreenshotStream();
    this.cursor = new WorkflowCursor({
      workflow: this.workflow,
      preferredStartNodeId: this.startNodeId,
      edgeEvaluator: (payload) => this.#evaluateEdge(payload),
    });

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
      const outcome = await this.#executeStep(step, { stepId: step.id });
      const advanceContext = this.#buildAdvanceContext(step, outcome);
      step = await this.cursor.advance({
        requestedNextId: outcome?.requestedNextId,
        context: advanceContext,
      });
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
      const runResult = await this.nodeRunner.execute({
        step,
        runtime: {
          automation: this.browserSession,
          execution: this.execution,
          meta: enrichedMeta,
          index,
          runId: this.runId,
          publishEvent: this.eventPublisher,
          logger: this.logger,
        },
      });
      this.workflowExecution.completeNode(step.id, { outputs: runResult.outputs ?? null });
      if (this.events?.stepEnd) {
        await this.events.stepEnd({ index, ok: true, meta: enrichedMeta });
      }
      return {
        requestedNextId: runResult.requestedNextId,
        outputs: runResult.outputs,
        handlerResult: runResult.rawResult,
        meta: enrichedMeta,
      };
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

  #buildAdvanceContext(step, outcome) {
    return {
      step,
      outputs: outcome?.outputs ?? null,
      handlerResult: outcome?.handlerResult ?? null,
      meta: outcome?.meta ?? null,
      executionContext: this.execution,
      workflowExecution: this.workflowExecution,
      automation: this.browserSession,
    };
  }

  #executionSnapshot() {
    return buildExecutionView(this.workflowExecution);
  }

  async #emitRunStatus(status, extra = {}) {
    await this.events?.runStatus(status, { execution: this.#executionSnapshot(), ...extra });
  }

  async #evaluateEdge({ edge, context }) {
    if (!edge.condition) {
      return true;
    }
    try {
      switch (edge.condition.type) {
        case 'expression':
          return this.#evaluateExpressionCondition(edge.condition, context);
        default:
          this.logger.warn?.(`Unsupported edge condition type: ${edge.condition.type}`);
          return false;
      }
    } catch (error) {
      this.logger.warn?.('Failed to evaluate edge condition', { edgeId: edge.id, error });
      return false;
    }
  }

  #evaluateExpressionCondition(condition, context) {
    const expression = condition.expression;
    if (typeof expression !== 'string' || !expression.trim()) {
      return false;
    }
    const evaluator = this.#getCompiledExpression(expression);
    const state = {
      outputs: context?.outputs ?? null,
      handlerResult: context?.handlerResult ?? null,
      meta: context?.meta ?? null,
      variables: context?.executionContext?.getVariablesSnapshot?.() ?? {},
      execution: context?.workflowExecution ?? null,
      step: context?.step ?? null,
      runId: this.runId,
      workflowId: this.workflow?.id ?? null,
      parameters: condition.parameters ?? {},
    };
    return Boolean(evaluator(state));
  }

  #getCompiledExpression(expression) {
    if (this.expressionCache.has(expression)) {
      return this.expressionCache.get(expression);
    }
    const fn = new Function('state', `
      "use strict";
      return (${expression});
    `);
    this.expressionCache.set(expression, fn);
    return fn;
  }
}
