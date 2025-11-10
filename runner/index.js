import 'dotenv/config';
import express from 'express';
import {
  WorkflowExecutor,
  RunManager,
  ValidationError,
  InvariantViolationError,
  RunWorkflowUseCase,
} from '#domain/index.js';
import { postEvent } from './infrastructure/portal/http-run-event-publisher.js';
import PlaywrightSession from './infrastructure/browser/playwright-session.js';
import RunEventDispatcher from './infrastructure/portal/ws-run-event-dispatcher.js';
import { createStepHandlerMap } from './infrastructure/browser/step-handlers.js';

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 4);
const PORT = Number(process.env.PORT || 4000);

const stepHandlers = createStepHandlerMap();

const runWorkflowUseCase = new RunWorkflowUseCase({
  runnerFactory: ({ workflow, execution, runId, startNodeId }) =>
    new WorkflowExecutor({
      workflow,
      execution,
      runId,
      startNodeId,
      logger: console,
      browserSessionFactory: (ctx) => new PlaywrightSession(ctx),
      eventDispatcherFactory: ({ runId, logger, publish }) =>
        new RunEventDispatcher({ runId, logger, postEvent: publish ?? postEvent }),
      stepHandlers,
      eventPublisher: postEvent,
    }),
  logger: console,
});

const runManager = new RunManager({
  maxConcurrency: MAX_CONCURRENCY,
  runWorkflow: ({ runId, workflow }) => runWorkflowUseCase.execute({ runId, workflowInput: workflow }),
  logger: console,
});

export function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post('/run', async (req, res) => {
    const runId = String(req.body?.runId || '').trim();
    const workflowData = req.body?.workflow;
    try {
      await runManager.enqueue({ runId, workflow: workflowData });
      return res.status(202).json({ accepted: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message, ...(error.metadata ?? {}) });
      }
      if (error instanceof InvariantViolationError) {
        return res.status(429).json({ error: error.message, ...(error.metadata ?? {}) });
      }
      console.error('Runner request failed', error);
      return res.status(500).json({ error: 'runner failed', message: error?.message || String(error) });
    }
  });

  app.get('/healthz', (_req, res) => {
    const metrics = runManager.getMetrics();
    res.json({ ok: true, ...metrics });
  });

  app.listen(PORT, () => {
    console.log(`Runner listening on :${PORT}`);
  });
}

startServer();
