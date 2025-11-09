import { ValidationError } from '../../errors.js';

export default class ScrollConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const dx = Number(config.dx ?? 0);
    const dy = Number(config.dy ?? 0);
    if (!Number.isFinite(dx) && !Number.isFinite(dy)) {
      throw new ValidationError('scroll config must include dx or dy');
    }
    this.dx = dx;
    this.dy = dy;
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof ScrollConfig) {
      return raw;
    }
    return new ScrollConfig(raw);
  }
}
