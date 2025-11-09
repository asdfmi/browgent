import { deepFreeze } from '../utils/object-utils.js';
import { requireNonEmptyString } from '../utils/validation.js';
import { ValidationError } from '../errors.js';

export default class DataBinding {
  constructor({
    sourceNodeId,
    sourceOutput = null,
    targetNodeId,
    targetInput,
    transform = null,
  }) {
    this.sourceNodeId = requireNonEmptyString(sourceNodeId, 'DataBinding.sourceNodeId');
    this.sourceOutput = sourceOutput === null || sourceOutput === undefined
      ? null
      : requireNonEmptyString(sourceOutput, 'DataBinding.sourceOutput');
    this.targetNodeId = requireNonEmptyString(targetNodeId, 'DataBinding.targetNodeId');
    this.targetInput = requireNonEmptyString(targetInput, 'DataBinding.targetInput');
    this.transform = DataBinding.#normalizeTransform(transform);
    Object.freeze(this);
  }

  static #normalizeTransform(transform) {
    if (transform === null || transform === undefined) return null;
    if (typeof transform === 'object') {
      return deepFreeze({ ...transform });
    }
    return transform;
  }

  static from(value) {
    if (!value) {
      throw new ValidationError('DataBinding input is required');
    }
    if (value instanceof DataBinding) return value;
    return new DataBinding(value);
  }
}
