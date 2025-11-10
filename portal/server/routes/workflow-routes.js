import express from 'express';
import WorkflowController from '../controllers/workflow-controller.js';
import { asyncHandler } from '../utils/http.js';

export default function createWorkflowRouter({ workflowFactory, workflowExecutionService }) {
  const controller = new WorkflowController({ workflowFactory, workflowExecutionService });
  const router = express.Router();

  router.get('/workflows', asyncHandler(controller.listWorkflows));
  router.post('/workflows/draft', asyncHandler(controller.createDraftWorkflow));
  router.get('/workflows/:workflowId', asyncHandler(controller.getWorkflow));
  router.put('/workflows/:workflowId', asyncHandler(controller.updateWorkflow));
  router.get('/workflows/:workflowId/runs', asyncHandler(controller.listRuns));
  router.post('/workflows/:workflowId/run', asyncHandler(controller.runWorkflow));

  return router;
}
