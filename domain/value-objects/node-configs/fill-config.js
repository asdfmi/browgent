import { requireNonEmptyString } from '../../utils/validation.js';

export default class FillConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const xpath = typeof config.xpath === 'string' ? config.xpath : '';
    const value = typeof config.value === 'string' ? config.value : '';
    this.xpath = requireNonEmptyString(xpath, 'fill config.xpath');
    this.value = requireNonEmptyString(value, 'fill config.value');
    this.clear = Boolean(config.clear);
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof FillConfig) {
      return raw;
    }
    return new FillConfig(raw);
  }
}

