import {
  WorkflowFactory,
  WorkflowExecutionService,
} from '#domain/index.js';
import {
  PrismaWorkflowRepository,
  PrismaWorkflowExecutionRepository,
} from './infrastructure/prisma/index.js';

export function buildContainer() {
  const workflowRepository = new PrismaWorkflowRepository();
  const workflowExecutionRepository = new PrismaWorkflowExecutionRepository();

  const workflowFactory = new WorkflowFactory({ workflowRepo: workflowRepository });
  const workflowExecutionService = new WorkflowExecutionService({ executionRepo: workflowExecutionRepository });

  return {
    workflowRepository,
    workflowExecutionRepository,
    workflowFactory,
    workflowExecutionService,
  };
}
