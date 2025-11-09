import { ValidationError } from '../../errors.js';

export default class WaitConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const timeout = typeof config.timeout === 'number' ? config.timeout : 1;
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new ValidationError('wait config.timeout must be greater than 0');
    }
    this.timeout = timeout;
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof WaitConfig) {
      return raw;
    }
    return new WaitConfig(raw);
  }
}
