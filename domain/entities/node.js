import { optionalString, requireNonEmptyString } from '../utils/validation.js';

export default class Node {
  constructor({
    id,
    name,
    type,
    inputs = [],
    outputs = [],
    config = null,
  }) {
    this.id = requireNonEmptyString(id, 'Node.id');
    this.type = requireNonEmptyString(type, 'Node.type');
    this.name = optionalString(name);
    this.inputs = inputs ?? [];
    this.outputs = outputs ?? [];
    this.nodeConfig = config;
  }

  getInputNames() {
    return this.inputs.map((port) => port.name);
  }

  getRequiredInputs() {
    return this.inputs.filter((port) => port.required !== false).map((port) => port.name);
  }

  getOutputNames() {
    return this.outputs.map((port) => port.name);
  }

  hasOutput(name) {
    return this.getOutputNames().includes(name);
  }

  get config() {
    return this.nodeConfig ?? null;
  }
}
