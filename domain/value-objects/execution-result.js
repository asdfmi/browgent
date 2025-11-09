import { requireBoolean } from '../utils/validation.js';
import { ValidationError } from '../errors.js';

export default class ExecutionResult {
  constructor({
    success,
    outputs = null,
    error = null,
    finishedAt = new Date(),
  }) {
    this.success = requireBoolean(success, 'ExecutionResult.success');
    this.outputs = outputs;
    this.error = error ? String(error) : null;
    this.finishedAt = finishedAt instanceof Date ? finishedAt : new Date(finishedAt);
    Object.freeze(this);
  }

  static from(value) {
    if (!value) {
      throw new ValidationError('ExecutionResult input is required');
    }
    if (value instanceof ExecutionResult) return value;
    return new ExecutionResult(value);
  }
}
