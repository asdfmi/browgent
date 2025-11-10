import { InvariantViolationError } from '../errors.js';
import { requireNonEmptyString } from '../utils/validation.js';

function normalizeHandlerMap(handlers) {
  if (!handlers) return [];
  if (handlers instanceof Map) {
    return [...handlers.entries()];
  }
  if (typeof handlers === 'object') {
    return Object.entries(handlers);
  }
  return [];
}

const DEFAULT_LOGGER = globalThis.console ?? {};

export default class NodeRunner {
  constructor({ handlers = {}, logger = DEFAULT_LOGGER } = {}) {
    this.logger = logger;
    this.handlers = new Map();
    this.registerHandlers(handlers);
  }

  registerHandler(type, handler) {
    const normalizedType = requireNonEmptyString(type, 'NodeRunner.handlerType');
    if (typeof handler !== 'function') {
      throw new InvariantViolationError(`Handler for node type "${normalizedType}" must be a function`);
    }
    this.handlers.set(normalizedType, handler);
  }

  registerHandlers(handlers) {
    for (const [type, handler] of normalizeHandlerMap(handlers)) {
      this.registerHandler(type, handler);
    }
  }

  async execute({ step, runtime = {} } = {}) {
    const normalizedStep = NodeRunner.#normalizeStep(step);
    const handler = this.handlers.get(normalizedStep.type);
    if (!handler) {
      throw new InvariantViolationError(`No handler registered for node type "${normalizedStep.type}"`);
    }
    const payload = { ...runtime, step: normalizedStep };
    const result = await handler(payload);
    return NodeRunner.#interpretResult(result);
  }

  static #normalizeStep(step) {
    if (!step || typeof step !== 'object') {
      throw new InvariantViolationError('step is required for NodeRunner.execute');
    }
    requireNonEmptyString(step.type, 'Workflow step type');
    if (step.id !== undefined && step.id !== null) {
      requireNonEmptyString(step.id, 'Workflow step id');
    }
    return step;
  }

  static #interpretResult(result) {
    if (!result) {
      return { requestedNextId: undefined, outputs: null, rawResult: result ?? null };
    }
    if (typeof result === 'object') {
      const requestedNextId = typeof result.nextStepId === 'string' ? result.nextStepId : undefined;
      const outputs = Object.prototype.hasOwnProperty.call(result, 'outputs') ? result.outputs : null;
      return { requestedNextId, outputs, rawResult: result };
    }
    if (typeof result === 'string') {
      return { requestedNextId: result, outputs: null, rawResult: result };
    }
    return { requestedNextId: undefined, outputs: result, rawResult: result };
  }
}
