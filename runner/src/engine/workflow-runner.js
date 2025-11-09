import BrowserSession from './browser-session.js';
import RunEventDispatcher from './run-events.js';
import SuccessEvaluator from './success-evaluator.js';
import ExecutionContext from './execution-context.js';
import handleNavigate from './steps/navigate.js';
import handleWait from './steps/wait.js';
import handleScroll from './steps/scroll.js';
import handleClick from './steps/click.js';
import handleFill from './steps/fill.js';
import handlePress from './steps/press.js';
import handleLog from './steps/log.js';
import handleScript from './steps/script.js';
import handleExtractText from './steps/extractText.js';

const STEP_HANDLERS = {
  navigate: handleNavigate,
  wait: handleWait,
  scroll: handleScroll,
  click: handleClick,
  fill: handleFill,
  press: handlePress,
  log: handleLog,
  script: handleScript,
  extract_text: handleExtractText,
};

export class WorkflowRunner {
  constructor({ workflow, runId, postEvent, logger = console }) {
    this.workflow = workflow;
    this.runId = runId;
    this.postEvent = postEvent;
    this.logger = logger;
    this.execution = new ExecutionContext();
    this.browserSession = null;
    this.events = null;
    this.successEvaluator = null;
    this.nodeIndex = null;
    this.nodeList = [];
    this.edgesBySource = new Map();
  }

  async run() {
    this.browserSession = await new BrowserSession({ logger: this.logger }).init();
    this.events = new RunEventDispatcher({ runId: this.runId, postEvent: this.postEvent, logger: this.logger });
    this.events.attachBrowserSession(this.browserSession);
    this.events.startScreenshotStream();
  	this.successEvaluator = new SuccessEvaluator({ browserSession: this.browserSession, execution: this.execution });

    await this.events.runStatus('running');
    try {
      const plan = this.#buildExecutionPlan();
      if (!plan) {
        throw new Error('workflow has no nodes to execute');
      }
      this.nodeIndex = plan.map;
      this.nodeList = plan.list;
      this.edgesBySource = plan.edgesBySource;
      await this.#executeFrom(plan.startId);
      await this.events.runStatus('succeeded');
      await this.events.done({ ok: true });
    } catch (error) {
      const message = String(error?.message || error);
      await this.events.runStatus('failed', { error: message });
      await this.events.done({ ok: false, error: message });
      throw error;
    } finally {
      this.events?.stopScreenshotStream();
      await this.browserSession?.cleanup();
    }
  }

  #buildExecutionPlan() {
    const nodes = Array.isArray(this.workflow?.nodes)
      ? this.workflow.nodes
      : Array.isArray(this.workflow?.steps)
        ? this.workflow.steps
        : [];
    if (nodes.length === 0) return null;

    const map = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
      const step = nodes[i];
      const id = typeof step?.id === 'string'
        ? step.id.trim()
        : typeof step?.nodeKey === 'string'
          ? step.nodeKey.trim()
          : '';
      if (!id) {
        return null;
      }
      if (typeof step.id !== 'string' || !step.id.trim()) {
        step.id = id;
      }
      map.set(id, { step, index: i });
    }

    const edgesBySource = new Map();
    const edges = Array.isArray(this.workflow?.edges) ? this.workflow.edges : [];
    for (const edge of edges) {
      const from =
        typeof edge?.from === 'string'
          ? edge.from.trim()
        : typeof edge?.source === 'string'
          ? edge.source.trim()
          : typeof edge?.sourceKey === 'string'
            ? edge.sourceKey.trim()
            : '';
      if (!from) continue;
      const to =
        typeof edge?.to === 'string'
          ? edge.to.trim()
          : typeof edge?.target === 'string'
            ? edge.target.trim()
            : typeof edge?.targetKey === 'string'
              ? edge.targetKey.trim()
              : '';
      const normalized = {
        id: typeof edge?.id === 'string' ? edge.id : typeof edge?.edgeKey === 'string' ? edge.edgeKey : undefined,
        from,
        to: to || null,
        label: typeof edge?.label === 'string' ? edge.label : null,
        condition: edge?.condition && typeof edge.condition === 'object' ? edge.condition : null,
        metadata: edge?.metadata && typeof edge.metadata === 'object' ? edge.metadata : null,
      };
      if (typeof edge?.priority === 'number' && Number.isFinite(edge.priority)) {
        normalized.priority = edge.priority;
      }
      const list = edgesBySource.get(from) ?? [];
      list.push(normalized);
      edgesBySource.set(from, list);
    }

    for (const list of edgesBySource.values()) {
      list.sort((a, b) => {
        const aPriority = typeof a.priority === 'number' ? a.priority : Number.MAX_SAFE_INTEGER;
        const bPriority = typeof b.priority === 'number' ? b.priority : Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return 0;
      });
    }

    const defaultStart = nodes[0]
      ? (typeof nodes[0]?.id === 'string'
        ? nodes[0].id
        : typeof nodes[0]?.nodeKey === 'string'
          ? nodes[0].nodeKey
          : '')
      : '';
    const requestedStart = typeof this.workflow.start === 'string' ? this.workflow.start.trim() : '';
    const startId = requestedStart && map.has(requestedStart) ? requestedStart : defaultStart;
    if (!startId) return null;

    return { startId, map, list: nodes, edgesBySource };
  }

  async #executeFrom(startId) {
    let currentId = startId;
    while (currentId) {
      const entry = this.nodeIndex?.get(currentId);
      if (!entry) {
        throw new Error(`unknown node id: ${currentId}`);
      }
      const { step, index } = entry;
      const directive = await this.#executeStep(step, { stepId: step.id });
      let nextStepId = typeof directive?.nextStepId === 'string' ? directive.nextStepId.trim() : undefined;
      if (directive?.nextStepId === null) {
        nextStepId = null;
      }
      if (typeof nextStepId === 'undefined' || nextStepId === '') {
        nextStepId = await this.#selectNextNode(step.id);
      }
      if (typeof nextStepId === 'undefined') {
        const fallback = this.#getSequentialNext(index);
        nextStepId = fallback?.step?.id;
      }
      if (!nextStepId) break;
      if (!this.nodeIndex.has(nextStepId)) {
        throw new Error(`unknown next node id: ${nextStepId}`);
      }
      currentId = nextStepId;
    }
  }

  #getSequentialNext(index) {
    const nodes = this.nodeList;
    if (!Array.isArray(nodes)) return null;
    const nextStep = nodes[index + 1];
    if (!nextStep) return null;
    const nextId = typeof nextStep?.id === 'string'
      ? nextStep.id
      : typeof nextStep?.nodeKey === 'string'
        ? nextStep.nodeKey
        : null;
    if (!nextId) return null;
    return this.nodeIndex?.get(nextId) ?? null;
  }

  async #executeStep(step, meta) {
    if (!step || typeof step.type !== 'string') {
      throw new Error(`invalid step: ${JSON.stringify(step)}`);
    }
    const index = this.execution.nextStepIndex();
    const enrichedMeta = { ...meta, type: step.type, stepId: step.id ?? meta?.stepId };
    await this.events.stepStart({ index, meta: enrichedMeta });
    try {
      const handler = STEP_HANDLERS[step.type];
      if (!handler) {
        throw new Error(`unsupported step type: ${step.type}`);
      }
      const result = await handler({ runner: this, step, meta: enrichedMeta, index });
      let handled = false;
      let nextStepId;
      if (typeof result === 'boolean') {
        handled = result;
      } else if (result && typeof result === 'object') {
        handled = Boolean(result.handled);
        if ('nextStepId' in result) {
          nextStepId = result.nextStepId;
        }
      }
      if (!handled) {
        await this.successEvaluator.waitFor(step.success);
      }
      await this.events.stepEnd({ index, ok: true, meta: enrichedMeta });
      return { nextStepId };
    } catch (error) {
      const message = String(error?.message || error);
      await this.events.stepEnd({ index, ok: false, error: message, meta: enrichedMeta });
      throw error;
    }
  }

  async #selectNextNode(stepId) {
    const edges = this.edgesBySource.get(stepId);
    if (!edges || edges.length === 0) {
      return undefined;
    }
    for (const edge of edges) {
      if (edge.condition) {
        const ok = await this.successEvaluator.evaluate(edge.condition);
        if (!ok) continue;
      }
      return edge.to ?? null;
    }
    return undefined;
  }

  async evaluateOnPage(code) {
    const variables = this.execution.getVariablesSnapshot();
    return this.browserSession.evaluateOnPage(code, variables);
  }

  get page() {
    return this.browserSession?.page;
  }
}
