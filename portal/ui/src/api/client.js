const RAW_BASE_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
const BASE_URL = typeof RAW_BASE_URL === "string" ? RAW_BASE_URL.replace(/\/$/, "") : "";

class HttpError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE_URL) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getAuthToken() {
  const token = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_TOKEN) || "";
  return token || "";
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  if (contentType.includes("text/")) {
    return response.text().catch(() => "");
  }
  return null;
}

export async function request(path, options = {}) {
  const {
    method = "GET",
    headers: headersInit,
    body,
    json,
    signal,
    credentials = "same-origin",
    auth = true,
  } = options;

  const headers = new Headers(headersInit || {});
  let requestBody = body;

  if (typeof json !== "undefined") {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(json);
  } else if (
    requestBody &&
    typeof requestBody === "object" &&
    !(requestBody instanceof FormData) &&
    !(requestBody instanceof Blob) &&
    !(requestBody instanceof ArrayBuffer)
  ) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(requestBody);
  }

  if (auth) {
    const token = getAuthToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(resolveUrl(path), {
    method,
    headers,
    body: requestBody,
    signal,
    credentials,
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.error || data.message)) ||
      response.statusText ||
      "Request failed";
    throw new HttpError(message, { status: response.status, data });
  }

  return data;
}

export function createApiClient(defaults = {}) {
  return {
    request: (path, options) => request(path, { ...defaults, ...options }),
    get: (path, options) => request(path, { ...defaults, ...options, method: "GET" }),
    post: (path, options) => request(path, { ...defaults, ...options, method: "POST" }),
    put: (path, options) => request(path, { ...defaults, ...options, method: "PUT" }),
    patch: (path, options) => request(path, { ...defaults, ...options, method: "PATCH" }),
    delete: (path, options) => request(path, { ...defaults, ...options, method: "DELETE" }),
  };
}

export { HttpError };
