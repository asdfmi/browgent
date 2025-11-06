import { request } from "./client.js";

export function listWorkflows(options = {}) {
  return request("/api/workflows", options);
}

export function createDraftWorkflow(options = {}) {
  return request("/api/workflows/draft", { ...options, method: "POST" });
}

export function getWorkflow(id, options = {}) {
  if (id == null) throw new Error("workflow id is required");
  return request(`/api/workflows/${id}`, options);
}

export function runWorkflow(id, options = {}) {
  if (id == null) throw new Error("workflow id is required");
  return request(`/api/workflows/${id}/run`, { ...options, method: "POST" });
}

export function updateWorkflow(id, payload, options = {}) {
  if (id == null) throw new Error("workflow id is required");
  return request(`/api/workflows/${id}`, {
    ...options,
    method: "PUT",
    json: payload,
  });
}
