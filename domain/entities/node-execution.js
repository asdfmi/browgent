import { requireNonEmptyString } from '../utils/validation.js';
import { InvalidTransitionError, ValidationError } from '../errors.js';

export const NODE_EXECUTION_STATUS = Object.freeze({
  NOT_STARTED: 'NotStarted',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
});

const VALID_STATUSES = new Set(Object.values(NODE_EXECUTION_STATUS));

export default class NodeExecution {
  constructor({
    nodeId,
    status = NODE_EXECUTION_STATUS.NOT_STARTED,
    startedAt = null,
    completedAt = null,
    outputs = null,
    error = null,
  }) {
    this.nodeId = requireNonEmptyString(nodeId, 'NodeExecution.nodeId');
    if (!VALID_STATUSES.has(status)) {
      throw new ValidationError(`Invalid NodeExecution status: ${status}`);
    }
    this.status = status;
    this.startedAt = startedAt ? new Date(startedAt) : null;
    this.completedAt = completedAt ? new Date(completedAt) : null;
    this.outputs = outputs;
    this.error = error ? String(error) : null;
  }

  start(timestamp = new Date()) {
    if (this.status !== NODE_EXECUTION_STATUS.NOT_STARTED) {
      throw new InvalidTransitionError('NodeExecution can only start from NotStarted');
    }
    this.status = NODE_EXECUTION_STATUS.RUNNING;
    this.startedAt = new Date(timestamp);
  }

  succeed({ outputs = null, timestamp = new Date() } = {}) {
    if (this.status !== NODE_EXECUTION_STATUS.RUNNING) {
      throw new InvalidTransitionError('NodeExecution can only succeed from Running');
    }
    this.status = NODE_EXECUTION_STATUS.SUCCEEDED;
    this.completedAt = new Date(timestamp);
    this.outputs = outputs;
    this.error = null;
  }

  fail({ error, timestamp = new Date() } = {}) {
    if (this.status !== NODE_EXECUTION_STATUS.RUNNING) {
      throw new InvalidTransitionError('NodeExecution can only fail from Running');
    }
    this.status = NODE_EXECUTION_STATUS.FAILED;
    this.completedAt = new Date(timestamp);
    this.error = error ? String(error) : 'unknown_error';
  }

  cancel({ timestamp = new Date() } = {}) {
    if (
      this.status === NODE_EXECUTION_STATUS.SUCCEEDED ||
      this.status === NODE_EXECUTION_STATUS.FAILED
    ) {
      throw new InvalidTransitionError('NodeExecution cannot be cancelled after completion');
    }
    this.status = NODE_EXECUTION_STATUS.CANCELLED;
    this.completedAt = new Date(timestamp);
  }

  static from(value) {
    if (!value) {
      throw new ValidationError('NodeExecution input is required');
    }
    if (value instanceof NodeExecution) return value;
    return new NodeExecution(value);
  }
}
