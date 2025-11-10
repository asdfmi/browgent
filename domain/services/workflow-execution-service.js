import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../errors.js';
import WorkflowExecution from '../aggregates/workflow-execution.js';

const coerceDate = (value) => {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
};

export default class WorkflowExecutionService {
  constructor({
    executionRepo,
    idGenerator = () => randomUUID(),
  } = {}) {
    if (!executionRepo) {
      throw new Error('executionRepo is required');
    }
    this.executionRepo = executionRepo;
    this.idGenerator = idGenerator;
  }

  async startExecution(workflowId, { executionId } = {}) {
    const id = executionId ?? this.idGenerator();
    const execution = new WorkflowExecution({ id, workflowId });
    execution.start();
    await this.executionRepo.create(execution);
    return this.getExecution(execution.id);
  }

  async startNode(executionId, nodeId, { timestamp = new Date() } = {}) {
    return this.#mutateExecution(executionId, async (execution) => {
      execution.startNode(nodeId, coerceDate(timestamp));
    });
  }

  async completeNode(executionId, nodeId, { outputs = null, timestamp = new Date() } = {}) {
    return this.#mutateExecution(executionId, async (execution) => {
      execution.completeNode(nodeId, { outputs, timestamp: coerceDate(timestamp) });
    });
  }

  async failNode(executionId, nodeId, { error, timestamp = new Date() } = {}) {
    return this.#mutateExecution(executionId, async (execution) => {
      execution.failNode(nodeId, { error, timestamp: coerceDate(timestamp) });
    });
  }

  async cancelExecution(executionId, { timestamp = new Date() } = {}) {
    return this.#mutateExecution(executionId, async (execution) => {
      execution.markCancelled(coerceDate(timestamp));
    });
  }

  async retryExecution(executionId) {
    const existing = await this.executionRepo.findById(executionId);
    if (!existing) {
      throw new NotFoundError(`Execution ${executionId} not found`);
    }
    return this.startExecution(existing.execution.workflowId, {});
  }

  async recordMetric(executionId, metricInput) {
    return this.#mutateExecution(executionId, async (execution) => {
      execution.addMetric(metricInput);
    });
  }

  async getExecution(executionId) {
    const snapshot = await this.executionRepo.findById(executionId);
    if (!snapshot) {
      throw new NotFoundError(`Execution ${executionId} not found`);
    }
    return this.#toExecutionView(snapshot);
  }

  async listExecutions() {
    return this.executionRepo.listSummaries();
  }

  async #mutateExecution(executionId, mutator) {
    const snapshot = await this.executionRepo.findById(executionId);
    if (!snapshot) {
      throw new NotFoundError(`Execution ${executionId} not found`);
    }
    const execution = snapshot.execution;
    await mutator(execution, snapshot);
    await this.executionRepo.update(execution);
    const refreshed = await this.executionRepo.findById(executionId);
    if (!refreshed) {
      throw new NotFoundError(`Execution ${executionId} not found after update`);
    }
    return this.#toExecutionView(refreshed);
  }

  #toExecutionView(snapshot) {
    const { execution, nodes = [], metrics = [] } = snapshot;
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      startedAt: execution.startedAt ?? null,
      completedAt: execution.completedAt ?? null,
      result: execution.result
        ? {
            success: execution.result.success,
            outputs: execution.result.outputs,
            error: execution.result.error,
            finishedAt: execution.result.finishedAt ?? null,
          }
        : null,
      nodes: nodes.map((node) => ({
        id: node.id,
        nodeId: node.nodeId,
        status: node.status,
        outputs: node.outputs,
        error: node.error,
        startedAt: node.startedAt ?? null,
        completedAt: node.completedAt ?? null,
      })),
      metrics: metrics.map((metric) => ({
        id: metric.id,
        key: metric.key,
        type: metric.type,
        unit: metric.unit ?? null,
        value: metric.value,
        timestamp: metric.timestamp ?? null,
      })),
    };
  }
}
