import { requireNonEmptyString } from "../../utils/validation.js";

export default class FillConfig {
  constructor(rawConfig) {
    const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    this.xpath = requireNonEmptyString(config.xpath, "fill config.xpath");
    this.clear = Boolean(config.clear);
    this.value = requireNonEmptyString(config.value, "fill config.value");
    Object.freeze(this);
  }

  static from(raw) {
    if (raw instanceof FillConfig) {
      return raw;
    }
    return new FillConfig(raw);
  }
}
