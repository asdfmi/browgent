import "dotenv/config";
import express from "express";
import { registerApi } from "./api.js";
import { registerStatic } from "./static.js";
import { buildContainer } from "./container.js";
import { createWsRunEventHub } from "./infrastructure/ws/run-event-hub.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

const container = buildContainer();
const runEventHub = createWsRunEventHub();

registerApi(app, {
  workflowFactory: container.workflowFactory,
  workflowExecutionService: container.workflowExecutionService,
  runEventHub,
  internalSecret: process.env.INTERNAL_SECRET || "",
});
registerStatic(app);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(port, () => {
  console.log(`Static server running → http://localhost:${port}`);
});

runEventHub.attach(server);
