import { WorkflowExecutionRepository as WorkflowExecutionRepositoryContract } from '../../../domain/index.js';
import prisma from '../../prisma/client.js';
import {
  toDomainWorkflowExecution,
  toNodeExecutionData,
  toMetricData,
} from './mappers/workflow-execution-mapper.js';

const ensureClient = (client) => client ?? prisma;

export default class PrismaWorkflowExecutionRepository extends WorkflowExecutionRepositoryContract {
  constructor({ client } = {}) {
    super();
    this.client = client ?? prisma;
  }

  async create(execution) {
    if (!execution) throw new Error('execution is required');
    const client = ensureClient(this.client);
    await client.$transaction(async (tx) => {
      await tx.workflowExecution.create({
        data: {
          id: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          result: execution.result ? {
            success: execution.result.success,
            outputs: execution.result.outputs,
            error: execution.result.error,
            finishedAt: execution.result.finishedAt,
          } : null,
          startedAt: execution.startedAt ?? null,
          completedAt: execution.completedAt ?? null,
        },
      });
      const nodeExecutions = execution.getNodeExecutions();
      if (nodeExecutions.length > 0) {
        await tx.nodeExecution.createMany({
          data: nodeExecutions.map((nodeExecution) => toNodeExecutionData(execution.id, nodeExecution)),
        });
      }
      const metrics = execution.getMetrics();
      if (metrics.length > 0) {
        await tx.executionMetric.createMany({
          data: metrics.map((metric) => toMetricData(execution.id, metric)),
        });
      }
    });
  }

  async update(execution) {
    if (!execution) throw new Error('execution is required');
    const client = ensureClient(this.client);
    await client.$transaction(async (tx) => {
      await tx.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: execution.status,
          result: execution.result ? {
            success: execution.result.success,
            outputs: execution.result.outputs,
            error: execution.result.error,
            finishedAt: execution.result.finishedAt,
          } : null,
          startedAt: execution.startedAt ?? null,
          completedAt: execution.completedAt ?? null,
        },
      });
      await tx.nodeExecution.deleteMany({ where: { workflowExecutionId: execution.id } });
      await tx.executionMetric.deleteMany({ where: { workflowExecutionId: execution.id } });
      const nodeExecutions = execution.getNodeExecutions();
      if (nodeExecutions.length > 0) {
        await tx.nodeExecution.createMany({
          data: nodeExecutions.map((nodeExecution) => toNodeExecutionData(execution.id, nodeExecution)),
        });
      }
      const metrics = execution.getMetrics();
      if (metrics.length > 0) {
        await tx.executionMetric.createMany({
          data: metrics.map((metric) => toMetricData(execution.id, metric)),
        });
      }
    });
  }

  async findById(executionId) {
    const client = ensureClient(this.client);
    const record = await client.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        nodes: true,
        metrics: true,
      },
    });
    if (!record) return null;
    const execution = toDomainWorkflowExecution(record);
    return {
      execution,
      nodes: record.nodes ?? [],
      metrics: record.metrics ?? [],
    };
  }

  async listSummaries() {
    const client = ensureClient(this.client);
    const rows = await client.workflowExecution.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        workflowId: true,
        status: true,
        updatedAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflowId,
      status: row.status,
      updatedAt: row.updatedAt ?? null,
    }));
  }
}
