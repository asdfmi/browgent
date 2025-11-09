import prisma from '../prisma/client.js';

export default class WorkflowNodeRepository {
  static create(data) {
    return prisma.workflowNode.create({ data });
  }

  static findById(id) {
    return prisma.workflowNode.findUnique({ where: { id } });
  }

  static listByWorkflow(workflowId) {
    return prisma.workflowNode.findMany({ where: { workflowId } });
  }

  static update(id, data) {
    return prisma.workflowNode.update({
      where: { id },
      data,
    });
  }

  static delete(id) {
    return prisma.workflowNode.delete({ where: { id } });
  }
}
