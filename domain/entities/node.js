import { optionalString, requireNonEmptyString } from "../utils/validation.js";

export default class Node {
  constructor({ id, name, type, config = null }) {
    this.id = requireNonEmptyString(id, "Node.id");
    this.type = requireNonEmptyString(type, "Node.type");
    this.name = optionalString(name);
    this.nodeConfig = config;
  }

  get config() {
    return this.nodeConfig ?? null;
  }

  toExecutionStep() {
    const config = this.nodeConfig ?? {};
    return {
      id: this.id,
      nodeKey: this.id,
      name: this.name ?? this.id,
      type: this.type,
      config,
    };
  }
}
