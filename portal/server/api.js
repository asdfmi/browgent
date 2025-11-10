import express from 'express';
import createWorkflowRouter from './routes/workflow-routes.js';
import createInternalRunRoutes from './routes/internal-run-routes.js';

export function registerApi(
  app,
  {
    workflowFactory,
    workflowExecutionService,
    runEventHub,
    internalSecret = '',
  } = {},
) {
  if (!workflowFactory || !workflowExecutionService) {
    throw new Error('workflow services are required to register API routes');
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api',
    createWorkflowRouter({
      workflowFactory,
      workflowExecutionService,
    }),
  );
  app.use(
    '/internal',
    createInternalRunRoutes({
      runEventHub,
      internalSecret,
    }),
  );
}
