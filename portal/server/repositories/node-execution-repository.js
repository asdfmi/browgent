import prisma from '../prisma/client.js';

export default class NodeExecutionRepository {
  static create(data) {
    return prisma.nodeExecution.create({ data });
  }

  static findById(id) {
    return prisma.nodeExecution.findUnique({ where: { id } });
  }

  static listByExecution(workflowExecutionId) {
    return prisma.nodeExecution.findMany({ where: { workflowExecutionId } });
  }

  static update(id, data) {
    return prisma.nodeExecution.update({
      where: { id },
      data,
    });
  }

  static delete(id) {
    return prisma.nodeExecution.delete({ where: { id } });
  }
}
