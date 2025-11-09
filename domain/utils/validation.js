import {
  DuplicateEntityError,
  InvariantViolationError,
  ValidationError,
} from '../errors.js';

const NON_WHITESPACE = /\S/;

export function requireNonEmptyString(value, label) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${label} must be a string`);
  }
  if (!NON_WHITESPACE.test(value)) {
    throw new ValidationError(`${label} must contain a non-whitespace character`);
  }
  return value;
}

export function optionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  return NON_WHITESPACE.test(value) ? value : null;
}

export function assertInvariant(condition, message, metadata) {
  if (!condition) {
    throw new InvariantViolationError(message, metadata);
  }
}

export function assertUnique(items, { getKey = (item) => item, label = 'value' } = {}) {
  const seen = new Set();
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      throw new DuplicateEntityError(`${label} "${String(key)}" must be unique`);
    }
    seen.add(key);
  }
}

export function assertInSet(value, allowed, label) {
  if (!allowed.has(value)) {
    const formatted = [...allowed].join(', ');
    throw new ValidationError(`${label} must be one of: ${formatted}`);
  }
}

export function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${label} must be a boolean`);
  }
  return value;
}

export function requireDefined(value, label) {
  if (value === undefined) {
    throw new ValidationError(`${label} is required`);
  }
  return value;
}
