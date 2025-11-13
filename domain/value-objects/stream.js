import { requireNonEmptyString } from "../utils/validation.js";
import { ValidationError } from "../errors.js";

export default class Stream {
  constructor({ fromNodeId, toNodeId }) {
    this.fromNodeId = requireNonEmptyString(fromNodeId, "Stream.fromNodeId");
    this.toNodeId = requireNonEmptyString(toNodeId, "Stream.toNodeId");
    Object.freeze(this);
  }

  static from(value) {
    if (!value) {
      throw new ValidationError("Stream input is required");
    }
    if (value instanceof Stream) return value;
    return new Stream(value);
  }
}
