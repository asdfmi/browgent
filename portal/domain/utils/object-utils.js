export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

export function stableStringify(value) {
  return JSON.stringify(value, (_key, val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val) || val instanceof Date) {
      return val;
    }
    return Object.keys(val)
      .sort()
      .reduce((result, key) => {
        // eslint-disable-next-line no-param-reassign
        result[key] = val[key];
        return result;
      }, {});
  });
}

export function deepFreeze(object) {
  if (!object || typeof object !== 'object') {
    return object;
  }
  const stack = [object];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    Object.freeze(current);
    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return object;
}
