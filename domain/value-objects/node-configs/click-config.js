import { requireNonEmptyString } from '../../utils/validation.js';

export default class ClickConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const xpath = typeof config.xpath === 'string' ? config.xpath : '';
    this.xpath = requireNonEmptyString(xpath, 'click config.xpath');
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof ClickConfig) {
      return raw;
    }
    return new ClickConfig(raw);
  }
}
