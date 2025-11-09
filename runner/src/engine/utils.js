export const DEFAULT_SUCCESS_TIMEOUT_SEC = 5;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeTimeoutSeconds(value, fallback = DEFAULT_SUCCESS_TIMEOUT_SEC) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

export function renderTemplate(template, context) {
  if (typeof template !== 'string') return template;
  return template.replace(/{{\s*variables\.([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = context.getVar(key);
    if (value === undefined || value === null) return '';
    return String(value);
  });
}
