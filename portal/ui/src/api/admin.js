import { request } from "./client.js";

export function listTables(options = {}) {
  return request("/api/admin/tables", options);
}

export function listRecords(table, options = {}) {
  if (!table) throw new Error("table name is required");
  return request(`/api/admin/${table}`, options);
}

export function deleteRecord(table, id, options = {}) {
  if (!table) throw new Error("table name is required");
  if (typeof id === "undefined" || id === null) throw new Error("record id is required");
  return request(`/api/admin/${table}/${id}`, { ...options, method: "DELETE" });
}

export function createRecord(table, data, options = {}) {
  if (!table) throw new Error("table name is required");
  return request(`/api/admin/${table}`, {
    ...options,
    method: "POST",
    json: { data },
  });
}

export function updateRecord(table, id, data, options = {}) {
  if (!table) throw new Error("table name is required");
  if (typeof id === "undefined" || id === null) throw new Error("record id is required");
  return request(`/api/admin/${table}/${id}`, {
    ...options,
    method: "PUT",
    json: { data },
  });
}
