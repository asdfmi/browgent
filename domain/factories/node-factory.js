import { ValidationError } from "../errors.js";
import { optionalString, requireNonEmptyString } from "../utils/validation.js";
import NavigateConfig from "../value-objects/node-configs/navigate-config.js";
import ScrollConfig from "../value-objects/node-configs/scroll-config.js";
import ClickConfig from "../value-objects/node-configs/click-config.js";
import FillConfig from "../value-objects/node-configs/fill-config.js";
import PressConfig from "../value-objects/node-configs/press-config.js";
import LogConfig from "../value-objects/node-configs/log-config.js";
import ScriptConfig from "../value-objects/node-configs/script-config.js";
import ExtractTextConfig from "../value-objects/node-configs/extract-text-config.js";
import WaitElementConfig from "../value-objects/node-configs/wait-element-config.js";
import WaitConfig from "../value-objects/node-configs/wait-config.js";
import { NODE_TYPES } from "../value-objects/node-configs/node-types.js";
import Node from "../entities/node.js";

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
  [NODE_TYPES.WAIT_ELEMENT, WaitElementConfig],
]);

function normalizeWaitElementTypeValue(value) {
  if (value === "attached") {
    return "exists";
  }
  return value ?? null;
}

export default class NodeFactory {
  static create(value) {
    if (!value) {
      throw new ValidationError("Node input is required");
    }
    if (value instanceof Node) {
      return value;
    }
    const { id, name, type, config } = value;
    const normalizedType = requireNonEmptyString(type, "Node.type");
    const waitAdjusted = NodeFactory.#adjustWaitNode({
      type: normalizedType,
      config,
    });
    return new Node({
      id: requireNonEmptyString(id, "Node.id"),
      name: optionalString(name),
      type: waitAdjusted.type,
      config: NodeFactory.#createNodeConfig(
        waitAdjusted.type,
        waitAdjusted.config,
      ),
    });
  }

  static #createNodeConfig(type, config) {
    const normalizedConfig = NodeFactory.#normalizeConfigShape(type, config);
    const ConfigClass = CONFIG_REGISTRY.get(type);
    if (!ConfigClass) {
      return normalizedConfig ?? null;
    }
    return ConfigClass.from(normalizedConfig);
  }

  static #normalizeConfigShape(type, config) {
    if (!config || typeof config !== "object") {
      return config ?? null;
    }
    if (type === NODE_TYPES.CLICK && config.options) {
      const { options, ...rest } = config;
      if (options && typeof options === "object") {
        return { ...rest, ...options };
      }
      return rest;
    }
    if (type === NODE_TYPES.WAIT) {
      if (
        typeof config.timeout === "number" &&
        Number.isFinite(config.timeout)
      ) {
        return { timeout: config.timeout };
      }
      return config ?? null;
    }
    if (type === NODE_TYPES.WAIT_ELEMENT) {
      const typeValue =
        typeof config.type === "string"
          ? config.type
          : typeof config.conditionType === "string"
            ? config.conditionType
            : null;
      const normalizedType = normalizeWaitElementTypeValue(typeValue);
      const xpath =
        typeof config.xpath === "string"
          ? config.xpath
          : typeof config.selector === "string"
            ? config.selector
            : typeof config.condition?.xpath === "string"
              ? config.condition.xpath
              : null;
      const timeout =
        typeof config.timeout === "number"
          ? config.timeout
          : typeof config.conditionTimeoutSeconds === "number"
            ? config.conditionTimeoutSeconds
            : typeof config.conditionTimeout === "number"
              ? config.conditionTimeout
              : typeof config.condition?.timeoutSeconds === "number"
                ? config.condition.timeoutSeconds
                : null;
      return {
        ...(normalizedType ? { type: normalizedType } : {}),
        ...(xpath ? { xpath } : {}),
        ...(timeout !== null ? { timeout } : {}),
      };
    }
    return config;
  }

  static #adjustWaitNode({ type, config }) {
    if (type !== NODE_TYPES.WAIT || !config || typeof config !== "object") {
      return { type, config };
    }
    const strategy =
      typeof config.strategy === "string"
        ? config.strategy.toLowerCase()
        : null;
    if (strategy !== "element_state") {
      const normalizedTimeout =
        typeof config.timeout === "number"
          ? config.timeout
          : typeof config.seconds === "number"
            ? config.seconds
            : null;
      return {
        type,
        config:
          normalizedTimeout !== null ? { timeout: normalizedTimeout } : config,
      };
    }
    const conditionType =
      typeof config.conditionType === "string"
        ? config.conditionType
        : typeof config.condition?.type === "string"
          ? config.condition.type
          : "visible";
    const xpath =
      typeof config.xpath === "string" && config.xpath
        ? config.xpath
        : typeof config.condition?.xpath === "string"
          ? config.condition.xpath
          : typeof config.selector === "string"
            ? config.selector
            : "";
    const conditionTimeoutSeconds =
      typeof config.conditionTimeoutSeconds === "number"
        ? config.conditionTimeoutSeconds
        : typeof config.condition?.timeoutSeconds === "number"
          ? config.condition.timeoutSeconds
          : typeof config.conditionTimeout === "number"
            ? config.conditionTimeout
            : typeof config.timeout === "number"
              ? config.timeout
              : 10;
    return {
      type: NODE_TYPES.WAIT_ELEMENT,
      config: {
        type: normalizeWaitElementTypeValue(conditionType) ?? "visible",
        xpath,
        timeout: conditionTimeoutSeconds,
      },
    };
  }
}
