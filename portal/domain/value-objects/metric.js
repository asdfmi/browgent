import { requireDefined, requireNonEmptyString } from '../utils/validation.js';

export default class Metric {
  constructor({
    key,
    type,
    value,
    unit = null,
    timestamp = new Date(),
  }) {
    this.key = requireNonEmptyString(key, 'Metric.key');
    this.type = requireNonEmptyString(type, 'Metric.type');
    this.value = requireDefined(value, 'Metric.value');
    this.unit = unit ? requireNonEmptyString(unit, 'Metric.unit') : null;
    this.timestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
    Object.freeze(this);
  }
}
