import prisma from '../prisma/client.js';

export default class ExecutionMetricRepository {
  static create(data) {
    return prisma.executionMetric.create({ data });
  }

  static findById(id) {
    return prisma.executionMetric.findUnique({ where: { id } });
  }

  static listByExecution(workflowExecutionId) {
    return prisma.executionMetric.findMany({ where: { workflowExecutionId } });
  }

  static delete(id) {
    return prisma.executionMetric.delete({ where: { id } });
  }
}
