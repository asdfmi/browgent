import { requireNonEmptyString } from '../../utils/validation.js';

export default class LogConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const message = typeof config.message === 'string' ? config.message : '';
    const target = typeof config.target === 'string' ? config.target : 'agent-flow';
    const level = typeof config.level === 'string' ? config.level : 'info';
    this.message = requireNonEmptyString(message, 'log config.message');
    this.target = target;
    this.level = level;
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof LogConfig) {
      return raw;
    }
    return new LogConfig(raw);
  }
}
