import { WorkflowRepository as WorkflowRepositoryContract } from "@agent-flow/domain";
import prisma from "../../prisma/client.js";
import { toDomainWorkflow } from "./mappers/workflow-mapper.js";

const ensureClient = (client) => client ?? prisma;

export default class PrismaWorkflowRepository extends WorkflowRepositoryContract {
  constructor({ client } = {}) {
    super();
    this.client = client ?? prisma;
  }

  async save({ workflow, definition, metadata = {} }) {
    if (!workflow) throw new Error("workflow is required");
    if (!definition) throw new Error("definition payload is required");
    const client = ensureClient(this.client);
    await client.$transaction(async (tx) => {
      await tx.workflow.upsert({
        where: { id: workflow.id },
        update: {
          name: workflow.name,
          description: metadata.description ?? null,
        },
        create: {
          id: workflow.id,
          name: workflow.name,
          description: metadata.description ?? null,
        },
      });
      await tx.workflowNode.deleteMany({ where: { workflowId: workflow.id } });
      await tx.workflowEdge.deleteMany({ where: { workflowId: workflow.id } });
      await tx.workflowStream.deleteMany({
        where: { workflowId: workflow.id },
      });
      if (definition.nodes.length > 0) {
        await tx.workflowNode.createMany({
          data: definition.nodes.map((node) => ({
            id: node.id,
            workflowId: workflow.id,
            name: node.name,
            type: node.type,
            config: node.config ?? null,
            positionX:
              typeof node.positionX === "number" ? node.positionX : null,
            positionY:
              typeof node.positionY === "number" ? node.positionY : null,
          })),
        });
      }
      if (definition.edges.length > 0) {
        await tx.workflowEdge.createMany({
          data: definition.edges.map((edge) => ({
            id: edge.id,
            workflowId: workflow.id,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            condition: edge.condition ?? null,
            priority: edge.priority ?? null,
          })),
        });
      }
      if (definition.streams.length > 0) {
        await tx.workflowStream.createMany({
          data: definition.streams.map((stream) => ({
            id: stream.id,
            workflowId: workflow.id,
            sourceNodeId: stream.sourceNodeId,
            targetNodeId: stream.targetNodeId,
          })),
        });
      }
    });
    return workflow.id;
  }

  async findById(workflowId) {
    const client = ensureClient(this.client);
    const workflowRecord = await client.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflowRecord) return null;
    const [nodes, edges, streams] = await Promise.all([
      client.workflowNode.findMany({ where: { workflowId } }),
      client.workflowEdge.findMany({ where: { workflowId } }),
      client.workflowStream.findMany({ where: { workflowId } }),
    ]);
    const workflow = toDomainWorkflow({
      workflowRecord,
      nodeRecords: nodes,
      edgeRecords: edges,
      streamRecords: streams,
    });
    return {
      workflow,
      definition: {
        nodes,
        edges,
        streams,
      },
      metadata: {
        id: workflowRecord.id,
        name: workflowRecord.name,
        description: workflowRecord.description ?? null,
        createdAt: workflowRecord.createdAt ?? null,
        updatedAt: workflowRecord.updatedAt ?? null,
      },
    };
  }

  async listSummaries() {
    const client = ensureClient(this.client);
    const rows = await client.workflow.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
  }
}
