import "dotenv/config";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";

const moduleFile = fileURLToPath(import.meta.url);
const apiDir = path.dirname(moduleFile);
const repoRoot = path.resolve(apiDir, "..", "..");

const clientDistDir = path.join(repoRoot, "portal", "ui", "dist");
const workflowsHtmlPath = path.join(clientDistDir, "src", "pages", "workflows", "index.html");
const workflowBuilderHtmlPath = path.join(clientDistDir, "src", "pages", "workflow-builder", "index.html");
const app = express();
const port = Number(process.env.PORT) || 3000;

// Static asset delivery
app.use(express.static(clientDistDir));

// Static page routes
app.get(["/", "/workflows"], (_req, res) => {
  res.sendFile(workflowsHtmlPath);
});
app.get("/workflow/:workflowId", (_req, res) => {
  res.sendFile(workflowBuilderHtmlPath);
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Static server running → http://localhost:${port}`);
});
