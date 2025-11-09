import { deepFreeze } from '../utils/object-utils.js';
import { assertInSet, requireNonEmptyString } from '../utils/validation.js';

export const CONDITION_TYPES = new Set([
  'expression',
  'script',
  'event',
  'predicate',
]);

export default class Condition {
  constructor({
    type,
    expression = null,
    parameters = {},
  } = {}) {
    this.type = requireNonEmptyString(type, 'Condition.type');
    assertInSet(this.type, CONDITION_TYPES, 'Condition.type');
    this.expression = expression === null ? null : requireNonEmptyString(expression, 'Condition.expression');
    const normalizedParameters = parameters && typeof parameters === 'object' ? parameters : {};
    this.parameters = deepFreeze({ ...normalizedParameters });
    Object.freeze(this);
  }

  static from(value) {
    if (!value) return null;
    if (value instanceof Condition) return value;
    return new Condition(value);
  }
}
