import Condition from './condition.js';
import { requireNonEmptyString } from '../utils/validation.js';
import { ValidationError } from '../errors.js'; // Domain-level validation (structural rule violations)

export default class Edge {
  constructor({
    from,
    to,
    condition = null,
    priority = null,
  }) {
    this.from = requireNonEmptyString(from, 'Edge.from');
    this.to = requireNonEmptyString(to, 'Edge.to');
    this.priority = Edge.#normalizePriority(priority);
    this.condition = Condition.from(condition);
    Object.freeze(this);
  }

  static #normalizePriority(priority) {
    if (priority === null || priority === undefined) {
      return null;
    }
    if (!Number.isFinite(priority)) {
      throw new ValidationError('Edge.priority must be a finite number');
    }
    if (priority < 0) {
      throw new ValidationError('Edge.priority must be greater than or equal to 0');
    }
    return priority;
  }

  get isUnconditional() {
    return this.condition === null;
  }
}
