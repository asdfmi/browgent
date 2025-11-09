import { requireNonEmptyString } from '../../utils/validation.js';

export default class ExtractTextConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const xpath = typeof config.xpath === 'string' ? config.xpath : '';
    const as = typeof config.as === 'string' ? config.as : '';
    this.xpath = requireNonEmptyString(xpath, 'extract_text config.xpath');
    this.as = requireNonEmptyString(as, 'extract_text config.as');
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof ExtractTextConfig) {
      return raw;
    }
    return new ExtractTextConfig(raw);
  }
}
