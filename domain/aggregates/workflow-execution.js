import NodeExecution, { NODE_EXECUTION_STATUS } from '../entities/node-execution.js';
import ExecutionResult from '../value-objects/execution-result.js';
import Metric from '../value-objects/metric.js';
import { requireNonEmptyString } from '../utils/validation.js';
import { InvalidTransitionError, InvariantViolationError, ValidationError } from '../errors.js';

export const WORKFLOW_EXECUTION_STATUS = Object.freeze({
  NOT_STARTED: 'NotStarted',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
});

const VALID_WORKFLOW_STATUSES = new Set(Object.values(WORKFLOW_EXECUTION_STATUS));

export default class WorkflowExecution {
  constructor({
    id,
    workflowId,
    status = WORKFLOW_EXECUTION_STATUS.NOT_STARTED,
    nodeExecutions = [],
    metrics = [],
    result = null,
    startedAt = null,
    completedAt = null,
    expectedNodeIds = [],
  }) {
    this.id = requireNonEmptyString(id, 'WorkflowExecution.id');
    this.workflowId = requireNonEmptyString(workflowId, 'WorkflowExecution.workflowId');
    this.status = WorkflowExecution.#ensureStatus(status);
    this.startedAt = startedAt ? new Date(startedAt) : null;
    this.completedAt = completedAt ? new Date(completedAt) : null;
    this.result = result ? ExecutionResult.from(result) : null;
    this.expectedNodeIds = WorkflowExecution.#normalizeExpectedNodeIds(expectedNodeIds);

    const executions = WorkflowExecution.#ensureArray(nodeExecutions, 'WorkflowExecution.nodeExecutions')
      .map((execution) => NodeExecution.from(execution));
    this.nodeExecutions = new Map(executions.map((execution) => [execution.nodeId, execution]));
    this.#ensureExpectedCoverage();

    this.metricDefinitions = new Map();
    this.metrics = [];
    WorkflowExecution.#ensureArray(metrics, 'WorkflowExecution.metrics').forEach((metric) => this.addMetric(metric));
  }

  static #ensureStatus(status) {
    if (!VALID_WORKFLOW_STATUSES.has(status)) {
      throw new ValidationError(`Invalid workflow execution status: ${status}`);
    }
    return status;
  }

  static #ensureArray(value, label) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value instanceof Set) {
      return [...value];
    }
    throw new InvariantViolationError(`${label} must be an array`);
  }

  static #normalizeExpectedNodeIds(nodeIds) {
    if (!nodeIds || nodeIds === undefined) return new Set();
    const array = WorkflowExecution.#ensureArray(nodeIds, 'WorkflowExecution.expectedNodeIds');
    const normalized = new Set();
    for (const nodeId of array) {
      const normalizedId = requireNonEmptyString(nodeId, 'WorkflowExecution.expectedNodeId');
      normalized.add(normalizedId);
    }
    return normalized;
  }

  #ensureExpectedCoverage() {
    if (this.expectedNodeIds.size === 0) {
      return;
    }
    for (const nodeId of this.expectedNodeIds) {
      if (!this.nodeExecutions.has(nodeId)) {
        this.nodeExecutions.set(nodeId, new NodeExecution({ nodeId }));
      }
    }
  }

  start(timestamp = new Date()) {
    if (this.status !== WORKFLOW_EXECUTION_STATUS.NOT_STARTED) {
      throw new InvalidTransitionError('WorkflowExecution can only start from NotStarted');
    }
    this.status = WORKFLOW_EXECUTION_STATUS.RUNNING;
    this.startedAt = new Date(timestamp);
  }

  startNode(nodeId, timestamp = new Date()) {
    this.#assertRunning();
    const nodeExecution = this.#getOrCreateNodeExecution(nodeId);
    nodeExecution.start(timestamp);
    return nodeExecution;
  }

  completeNode(nodeId, { outputs = null, timestamp = new Date() } = {}) {
    this.#assertRunning();
    const nodeExecution = this.#getOrCreateNodeExecution(nodeId);
    nodeExecution.succeed({ outputs, timestamp });
    this.#autoComplete(timestamp);
    return nodeExecution;
  }

  failNode(nodeId, { error, timestamp = new Date() } = {}) {
    this.#assertRunning();
    const nodeExecution = this.#getOrCreateNodeExecution(nodeId);
    nodeExecution.fail({ error, timestamp });
    this.#markFailed(error, timestamp);
    return nodeExecution;
  }

  cancelNode(nodeId, { timestamp = new Date() } = {}) {
    const nodeExecution = this.#getOrCreateNodeExecution(nodeId);
    nodeExecution.cancel({ timestamp });
    if (this.status === WORKFLOW_EXECUTION_STATUS.RUNNING) {
      this.status = WORKFLOW_EXECUTION_STATUS.CANCELLED;
      this.completedAt = new Date(timestamp);
      this.result = new ExecutionResult({ success: false, finishedAt: this.completedAt });
    }
    return nodeExecution;
  }

  markCancelled(timestamp = new Date()) {
    if (
      this.status === WORKFLOW_EXECUTION_STATUS.SUCCEEDED ||
      this.status === WORKFLOW_EXECUTION_STATUS.CANCELLED ||
      this.status === WORKFLOW_EXECUTION_STATUS.FAILED
    ) {
      return;
    }
    this.status = WORKFLOW_EXECUTION_STATUS.CANCELLED;
    this.completedAt = new Date(timestamp);
    this.result = new ExecutionResult({ success: false, finishedAt: this.completedAt });
  }

  addMetric(metricInput) {
    const metric = Metric.from(metricInput);
    const key = metric.key;
    if (this.metricDefinitions.has(key)) {
      const definition = this.metricDefinitions.get(key);
      if (definition.type !== metric.type || definition.unit !== metric.unit) {
        throw new InvariantViolationError(`Metric ${metric.key} changed type/unit`);
      }
    } else {
      this.metricDefinitions.set(key, { type: metric.type, unit: metric.unit });
    }
    this.metrics.push(metric);
    return metric;
  }

  getNodeExecution(nodeId) {
    return this.nodeExecutions.get(nodeId) ?? null;
  }

  getNodeExecutions() {
    return [...this.nodeExecutions.values()];
  }

  getMetrics() {
    return [...this.metrics];
  }

  #getOrCreateNodeExecution(nodeId) {
    this.#assertKnownNode(nodeId);
    let nodeExecution = this.nodeExecutions.get(nodeId);
    if (!nodeExecution) {
      nodeExecution = new NodeExecution({ nodeId });
      this.nodeExecutions.set(nodeId, nodeExecution);
    }
    return nodeExecution;
  }

  #assertRunning() {
    if (this.status !== WORKFLOW_EXECUTION_STATUS.RUNNING) {
      throw new InvalidTransitionError('WorkflowExecution is not running');
    }
  }

  #autoComplete(timestamp) {
    const nodeIds = this.expectedNodeIds.size > 0
      ? [...this.expectedNodeIds]
      : [...this.nodeExecutions.keys()];
    if (nodeIds.length === 0) {
      return;
    }
    const allDone = nodeIds.every((nodeId) => {
      const execution = this.nodeExecutions.get(nodeId);
      return execution && execution.status === NODE_EXECUTION_STATUS.SUCCEEDED;
    });
    if (allDone) {
      this.status = WORKFLOW_EXECUTION_STATUS.SUCCEEDED;
      this.completedAt = new Date(timestamp);
      this.result = new ExecutionResult({ success: true, finishedAt: this.completedAt });
    }
  }

  #markFailed(error, timestamp) {
    this.status = WORKFLOW_EXECUTION_STATUS.FAILED;
    this.completedAt = new Date(timestamp);
    this.result = new ExecutionResult({
      success: false,
      error: error ?? 'workflow_failed',
      finishedAt: this.completedAt,
    });
  }

  #assertKnownNode(nodeId) {
    if (this.expectedNodeIds.size === 0) return;
    if (!this.expectedNodeIds.has(nodeId)) {
      throw new ValidationError(`Node "${nodeId}" is not part of workflow execution ${this.id}`);
    }
  }
}
