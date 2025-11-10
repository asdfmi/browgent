export function buildExecutionView(execution) {
  if (!execution) return null;
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
    nodes: execution.getNodeExecutions().map((node) => ({
      nodeId: node.nodeId,
      status: node.status,
      outputs: node.outputs,
      error: node.error,
      startedAt: node.startedAt ?? null,
      completedAt: node.completedAt ?? null,
    })),
    metrics: execution.getMetrics().map((metric) => ({
      key: metric.key,
      type: metric.type,
      unit: metric.unit ?? null,
      value: metric.value,
      timestamp: metric.timestamp ?? null,
    })),
  };
}
