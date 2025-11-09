import 'dotenv/config';
import express from 'express';
import { WorkflowRunner } from './src/engine/workflow-runner.js';
import { postEvent } from './src/events.js';
import WorkflowValidator from './src/services/workflow-validator.js';
import RunManager from './src/services/run-manager.js';
import RequestError from './src/errors/request-error.js';

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 4);
const PORT = Number(process.env.PORT || 4000);

const validator = new WorkflowValidator({ schemaUrl: new URL('./src/schema/workflow.schema.json', import.meta.url) });
const runManager = new RunManager({
  maxConcurrency: MAX_CONCURRENCY,
  validator,
  runnerFactory: ({ workflow, runId }) => new WorkflowRunner({ workflow, runId, postEvent }),
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
      if (error instanceof RequestError) {
        return res.status(error.status).json(error.body);
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
