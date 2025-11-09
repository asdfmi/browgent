import {
  WorkflowExecution,
  NodeExecution,
  Metric,
  ExecutionResult,
} from '#domain/index.js';

export function toDomainWorkflowExecution(record) {
  if (!record) return null;
  return new WorkflowExecution({
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    nodeExecutions: (record.nodes ?? []).map((node) => new NodeExecution({
      nodeId: node.nodeId,
      status: node.status,
      outputs: node.outputs,
      error: node.error,
      startedAt: node.startedAt,
      completedAt: node.completedAt,
    })),
    metrics: (record.metrics ?? []).map((metric) => new Metric({
      key: metric.key,
      type: metric.type,
      unit: metric.unit,
      value: metric.value,
      timestamp: metric.timestamp,
    })),
    result: record.result ? new ExecutionResult(record.result) : null,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  });
}

export function toNodeExecutionData(executionId, nodeExecution) {
  return {
    workflowExecutionId: executionId,
    nodeId: nodeExecution.nodeId,
    status: nodeExecution.status,
    outputs: nodeExecution.outputs ?? null,
    error: nodeExecution.error ?? null,
    startedAt: nodeExecution.startedAt ?? null,
    completedAt: nodeExecution.completedAt ?? null,
  };
}

export function toMetricData(executionId, metric) {
  return {
    workflowExecutionId: executionId,
    key: metric.key,
    type: metric.type,
    unit: metric.unit,
    value: metric.value,
    timestamp: metric.timestamp ?? new Date(),
  };
}
