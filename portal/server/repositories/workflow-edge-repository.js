import prisma from '../prisma/client.js';

export default class WorkflowEdgeRepository {
  static create(data) {
    return prisma.workflowEdge.create({ data });
  }

  static findById(id) {
    return prisma.workflowEdge.findUnique({ where: { id } });
  }

  static listByWorkflow(workflowId) {
    return prisma.workflowEdge.findMany({ where: { workflowId } });
  }

  static update(id, data) {
    return prisma.workflowEdge.update({
      where: { id },
      data,
    });
  }

  static delete(id) {
    return prisma.workflowEdge.delete({ where: { id } });
  }
}
