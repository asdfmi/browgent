import prisma from '../prisma/client.js';

export default class WorkflowExecutionRepository {
  static create(data) {
    return prisma.workflowExecution.create({ data });
  }

  static findById(id) {
    return prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        nodes: true,
        metrics: true,
      },
    });
  }

  static list() {
    return prisma.workflowExecution.findMany();
  }

  static update(id, data) {
    return prisma.workflowExecution.update({
      where: { id },
      data,
    });
  }

  static delete(id) {
    return prisma.workflowExecution.delete({ where: { id } });
  }
}
