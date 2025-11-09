import { requireNonEmptyString } from '../../utils/validation.js';

export default class PressConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const xpath = typeof config.xpath === 'string' ? config.xpath : '';
    const key = typeof config.key === 'string' ? config.key : '';
    const delay = typeof config.delay === 'number' ? config.delay : null;
    this.xpath = requireNonEmptyString(xpath, 'press config.xpath');
    this.key = requireNonEmptyString(key, 'press config.key');
    this.delay = delay;
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof PressConfig) {
      return raw;
    }
    return new PressConfig(raw);
  }
}
