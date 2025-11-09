import NodeExecution, { NODE_EXECUTION_STATUS } from '../entities/node-execution.js';
import ExecutionResult from '../value-objects/execution-result.js';
import Metric from '../value-objects/metric.js';
import { requireNonEmptyString, assertInstances } from '../utils/validation.js';

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
  }) {
    this.id = requireNonEmptyString(id, 'WorkflowExecution.id');
    this.workflowId = requireNonEmptyString(workflowId, 'WorkflowExecution.workflowId');
    this.status = WorkflowExecution.#ensureStatus(status);
    this.startedAt = startedAt ? new Date(startedAt) : null;
    this.completedAt = completedAt ? new Date(completedAt) : null;
    this.result = result
      ? result instanceof ExecutionResult
        ? result
        : new ExecutionResult(result)
      : null;

    const executions = assertInstances(nodeExecutions, NodeExecution, 'WorkflowExecution.nodeExecutions');
    this.nodeExecutions = new Map(executions.map((execution) => [execution.nodeId, execution]));

    this.metricDefinitions = new Map();
    this.metrics = [];
    metrics.forEach((metric) => this.addMetric(metric));
  }

  static #ensureStatus(status) {
    if (!VALID_WORKFLOW_STATUSES.has(status)) {
      throw new Error(`Invalid workflow execution status: ${status}`);
    }
    return status;
  }

  start(timestamp = new Date()) {
    if (this.status !== WORKFLOW_EXECUTION_STATUS.NOT_STARTED) {
      throw new Error('WorkflowExecution can only start from NotStarted');
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
      this.status === WORKFLOW_EXECUTION_STATUS.CANCELLED
    ) {
      return;
    }
    this.status = WORKFLOW_EXECUTION_STATUS.CANCELLED;
    this.completedAt = new Date(timestamp);
    this.result = new ExecutionResult({ success: false, finishedAt: this.completedAt });
  }

  addMetric(metricInput) {
    const metric = metricInput instanceof Metric ? metricInput : new Metric(metricInput);
    const key = metric.key;
    if (this.metricDefinitions.has(key)) {
      const definition = this.metricDefinitions.get(key);
      if (definition.type !== metric.type || definition.unit !== metric.unit) {
        throw new Error(`Metric ${metric.key} changed type/unit`);
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

  #getOrCreateNodeExecution(nodeId) {
    let nodeExecution = this.nodeExecutions.get(nodeId);
    if (!nodeExecution) {
      nodeExecution = new NodeExecution({ nodeId });
      this.nodeExecutions.set(nodeId, nodeExecution);
    }
    return nodeExecution;
  }

  #assertRunning() {
    if (this.status !== WORKFLOW_EXECUTION_STATUS.RUNNING) {
      throw new Error('WorkflowExecution is not running');
    }
  }

  #autoComplete(timestamp) {
    const allDone = [...this.nodeExecutions.values()].every(
      (execution) => execution.status === NODE_EXECUTION_STATUS.SUCCEEDED,
    );
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
}
