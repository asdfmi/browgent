import prisma from '../prisma/client.js';

export default class WorkflowDataBindingRepository {
  static create(data) {
    return prisma.workflowDataBinding.create({ data });
  }

  static findById(id) {
    return prisma.workflowDataBinding.findUnique({ where: { id } });
  }

  static listByWorkflow(workflowId) {
    return prisma.workflowDataBinding.findMany({ where: { workflowId } });
  }

  static update(id, data) {
    return prisma.workflowDataBinding.update({
      where: { id },
      data,
    });
  }

  static delete(id) {
    return prisma.workflowDataBinding.delete({ where: { id } });
  }
}
