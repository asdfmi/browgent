import { ensureArray } from '../utils/object-utils.js';
import { ValidationError } from '../errors.js';
import { optionalString, requireNonEmptyString } from '../utils/validation.js';
import NavigateConfig from '../value-objects/node-configs/navigate-config.js';
import ScrollConfig from '../value-objects/node-configs/scroll-config.js';
import ClickConfig from '../value-objects/node-configs/click-config.js';
import FillConfig from '../value-objects/node-configs/fill-config.js';
import PressConfig from '../value-objects/node-configs/press-config.js';
import LogConfig from '../value-objects/node-configs/log-config.js';
import ScriptConfig from '../value-objects/node-configs/script-config.js';
import ExtractTextConfig from '../value-objects/node-configs/extract-text-config.js';
import WaitConfig from '../value-objects/node-configs/wait-config.js';
import { NODE_TYPES } from '../value-objects/node-configs/node-types.js';
import Node from '../entities/node.js';

const CONFIG_REGISTRY = new Map([
  [NODE_TYPES.NAVIGATE, NavigateConfig],
  [NODE_TYPES.SCROLL, ScrollConfig],
  [NODE_TYPES.CLICK, ClickConfig],
  [NODE_TYPES.FILL, FillConfig],
  [NODE_TYPES.PRESS, PressConfig],
  [NODE_TYPES.LOG, LogConfig],
  [NODE_TYPES.SCRIPT, ScriptConfig],
  [NODE_TYPES.EXTRACT_TEXT, ExtractTextConfig],
  [NODE_TYPES.WAIT, WaitConfig],
]);

function normalizePorts(definitions, { defaultRequired }) {
  return ensureArray(definitions).map((definition, index) => {
    if (typeof definition === 'string') {
      return {
        name: requireNonEmptyString(definition, `Node.port[${index}]`),
        required: defaultRequired,
      };
    }
    if (definition && typeof definition === 'object') {
      const name = requireNonEmptyString(definition.name, `Node.port[${index}].name`);
      const required = definition.required === undefined ? defaultRequired : Boolean(definition.required);
      return { name, required };
    }
    throw new ValidationError('Node ports must be strings or objects with a "name" property');
  });
}

export default class NodeFactory {
  static create(value) {
    if (!value) {
      throw new ValidationError('Node input is required');
    }
    if (value instanceof Node) {
      return value;
    }
    const { id, name, type, inputs, outputs, config } = value;
    return new Node({
      id: requireNonEmptyString(id, 'Node.id'),
      name: optionalString(name),
      type: requireNonEmptyString(type, 'Node.type'),
      inputs: normalizePorts(inputs, { defaultRequired: true }),
      outputs: normalizePorts(outputs, { defaultRequired: false }),
      config: NodeFactory.#createNodeConfig(type, config),
    });
  }

  static #createNodeConfig(type, config) {
    const ConfigClass = CONFIG_REGISTRY.get(type);
    if (!ConfigClass) {
      return config ?? null;
    }
    return ConfigClass.from(config);
  }
}
