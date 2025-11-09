import { requireNonEmptyString } from '../../utils/validation.js';

export default class NavigateConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const url = typeof config.url === 'string' ? config.url : '';
    const waitUntil = typeof config.waitUntil === 'string' ? config.waitUntil : '';
    this.url = requireNonEmptyString(url, 'navigate config.url');
    this.waitUntil = waitUntil;
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof NavigateConfig) {
      return raw;
    }
    return new NavigateConfig(raw);
  }
}
