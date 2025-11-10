import { NotFoundError } from '../errors.js';

export default class WorkflowFeedbackService {
  constructor({
    workflowRepo,
    executionRepo,
  } = {}) {
    if (!workflowRepo) {
      throw new Error('workflowRepo is required');
    }
    if (!executionRepo) {
      throw new Error('executionRepo is required');
    }
    this.workflowRepo = workflowRepo;
    this.executionRepo = executionRepo;
  }

  async generateFeedback(workflowId, executionId, { notes = '' } = {}) {
    const [workflowSnapshot, executionSnapshot] = await Promise.all([
      this.workflowRepo.findById(workflowId),
      this.executionRepo.findById(executionId),
    ]);
    if (!workflowSnapshot) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }
    if (!executionSnapshot) {
      throw new NotFoundError(`Execution ${executionId} not found`);
    }
    const { definition, metadata } = workflowSnapshot;

    const nodeDictionary = new Map(definition.nodes.map((node) => [node.id, node]));
    const nodeExecutions = executionSnapshot.nodes ?? [];
    const succeeded = nodeExecutions.filter((node) => node.status === 'Succeeded');
    const failed = nodeExecutions.filter((node) => node.status === 'Failed');
    const running = nodeExecutions.filter((node) => node.status === 'Running');
    const pendingIds = definition.nodes
      .map((node) => node.id)
      .filter((nodeId) => !nodeExecutions.some((exec) => exec.nodeId === nodeId));

    const metrics = (executionSnapshot.metrics ?? []).reduce((acc, metric) => {
      const existing = acc.get(metric.key) ?? [];
      existing.push(metric);
      acc.set(metric.key, existing);
      return acc;
    }, new Map());

    const metricSummaries = [...metrics.entries()].map(([key, entries]) => ({
      key,
      samples: entries.length,
      latest: entries[entries.length - 1]?.value ?? null,
      unit: entries[0]?.unit ?? null,
      type: entries[0]?.type ?? null,
    }));

    const actionItems = [
      ...failed.map((node) => ({
        nodeId: node.nodeId,
        nodeName: nodeDictionary.get(node.nodeId)?.name ?? node.nodeId,
        recommendation: `Investigate failure: ${node.error || 'unknown cause'}`,
      })),
      ...pendingIds.map((nodeId) => ({
        nodeId,
        nodeName: nodeDictionary.get(nodeId)?.name ?? nodeId,
        recommendation: 'Input bindings or conditions might be missing; review definition.',
      })),
    ];

    if (running.length === 0 && failed.length === 0 && pendingIds.length === 0) {
      actionItems.push({
        nodeId: null,
        nodeName: null,
        recommendation: 'Workflow executed successfully. Consider capturing best practices in notes.',
      });
    }

    const summary = {
      workflowId,
      workflowName: metadata.name,
      executionId,
      status: executionSnapshot.execution.status,
      totalNodes: definition.nodes.length,
      completedNodes: succeeded.length,
      failedNodes: failed.length,
      waitingNodes: running.length,
      pendingNodes: pendingIds.length,
      edges: definition.edges.length,
      dataBindings: definition.dataBindings.length,
    };

    return {
      summary,
      notes: notes || null,
      metrics: metricSummaries,
      actionItems,
    };
  }
}
