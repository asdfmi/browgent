import prisma from '../prisma/client.js';

export default class WorkflowRepository {
  static async create(data) {
    return prisma.workflow.create({ data });
  }

  static async findById(id) {
    return prisma.workflow.findUnique({
      where: { id },
    });
  }

  static async list() {
    return prisma.workflow.findMany();
  }

  static async update(id, data) {
    return prisma.workflow.update({
      where: { id },
      data,
    });
  }

  static async delete(id) {
    return prisma.workflow.delete({ where: { id } });
  }
}
