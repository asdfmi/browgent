import { requireNonEmptyString } from "../utils/validation.js";
import { ValidationError } from "../errors.js";

export default class Stream {
  constructor({ sourceNodeId, targetNodeId }) {
    this.sourceNodeId = requireNonEmptyString(
      sourceNodeId,
      "Stream.sourceNodeId",
    );
    this.targetNodeId = requireNonEmptyString(
      targetNodeId,
      "Stream.targetNodeId",
    );
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
