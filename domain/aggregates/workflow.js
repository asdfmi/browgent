import NodeFactory from '../factories/node-factory.js';
import Edge from '../value-objects/edge.js';
import DataBinding from '../value-objects/data-binding.js';
import { assertInvariant, requireNonEmptyString } from '../utils/validation.js';
import { stableStringify } from '../utils/object-utils.js';
import { hasCycle, computeDegrees } from '../utils/graph.js';
import { InvariantViolationError } from '../errors.js';

function routeKey(edge) {
  const conditionKey = edge.condition
    ? stableStringify({
        type: edge.condition.type,
        expression: edge.condition.expression,
        parameters: edge.condition.parameters,
      })
    : 'no-condition';
  return `${edge.from}->${edge.to}:${conditionKey}`;
}

export default class Workflow {
  constructor({
    id,
    name,
    nodes = [],
    edges = [],
    dataBindings = [],
  }) {
    this.id = requireNonEmptyString(id, 'Workflow.id');
    this.name = requireNonEmptyString(name, 'Workflow.name');

    if (!Array.isArray(nodes)) {
      throw new InvariantViolationError('Workflow.nodes must be an array');
    }
    this.nodes = nodes.map((node) => NodeFactory.create(node));
    assertInvariant(this.nodes.length > 0, 'Workflow must declare at least one node');
    this.nodesById = new Map(this.nodes.map((node) => [node.id, node]));
    assertInvariant(
      this.nodesById.size === this.nodes.length,
      'Workflow node ids must be unique',
    );

    if (!Array.isArray(edges)) {
      throw new InvariantViolationError('Workflow.edges must be an array');
    }
    this.edges = edges.map((edge) => Edge.from(edge));
    if (!Array.isArray(dataBindings)) {
      throw new InvariantViolationError('Workflow.dataBindings must be an array');
    }
    this.dataBindings = dataBindings.map((binding) => DataBinding.from(binding));

    this.edgesBySource = new Map();
    this.edgesByTarget = new Map();
    this.#buildEdgeIndexes();
    this.#validateEdges();
    this.#validateGraph();
    this.#validateBindings();
  }

  #buildEdgeIndexes() {
    for (const nodeId of this.nodesById.keys()) {
      this.edgesBySource.set(nodeId, []);
      this.edgesByTarget.set(nodeId, []);
    }
    for (const edge of this.edges) {
      if (!this.nodesById.has(edge.from)) {
        throw new InvariantViolationError(
          `Edge source "${edge.from}" is not part of workflow "${this.id}"`,
        );
      }
      if (!this.nodesById.has(edge.to)) {
        throw new InvariantViolationError(
          `Edge target "${edge.to}" is not part of workflow "${this.id}"`,
        );
      }
      this.edgesBySource.get(edge.from).push(edge);
      this.edgesByTarget.get(edge.to).push(edge);
    }
  }

  #validateEdges() {
    const routeSignatures = new Set();
    const prioritiesBySource = new Map();
    for (const edge of this.edges) {
      const signature = routeKey(edge);
      if (routeSignatures.has(signature)) {
        throw new InvariantViolationError(
          `Duplicate edge detected for ${edge.from} -> ${edge.to} with identical condition`,
        );
      }
      routeSignatures.add(signature);

      if (edge.priority === null) continue;
      const bucket = prioritiesBySource.get(edge.from) ?? new Set();
      if (bucket.has(edge.priority)) {
        throw new InvariantViolationError(
          `Edges originating from "${edge.from}" must have unique priority values`,
        );
      }
      bucket.add(edge.priority);
      prioritiesBySource.set(edge.from, bucket);
    }
  }

  #validateGraph() {
    const nodeIds = [...this.nodesById.keys()];
    if (hasCycle(nodeIds, this.edges)) {
      throw new InvariantViolationError('Workflow must be a DAG (no cycles allowed)');
    }
    const { inDegree, outDegree } = computeDegrees(nodeIds, this.edges);
    this.startNodeIds = nodeIds.filter((id) => inDegree.get(id) === 0);
    this.endNodeIds = nodeIds.filter((id) => outDegree.get(id) === 0);
    assertInvariant(this.startNodeIds.length > 0, 'Workflow must expose at least one start node');
    assertInvariant(this.endNodeIds.length > 0, 'Workflow must expose at least one end node');
  }

  #validateBindings() {
    const coverage = new Map();
    for (const node of this.nodes) {
      coverage.set(node.id, new Set());
    }
    for (const binding of this.dataBindings) {
      const sourceNode = this.nodesById.get(binding.sourceNodeId);
      if (!sourceNode) {
        throw new InvariantViolationError(
          `Binding references unknown source node "${binding.sourceNodeId}"`,
        );
      }
      if (binding.sourceOutput && !sourceNode.hasOutput(binding.sourceOutput)) {
        throw new InvariantViolationError(
          `Binding references missing output "${binding.sourceOutput}" on node "${sourceNode.id}"`,
        );
      }
      const targetNode = this.nodesById.get(binding.targetNodeId);
      if (!targetNode) {
        throw new InvariantViolationError(
          `Binding references unknown target node "${binding.targetNodeId}"`,
        );
      }
      if (!targetNode.getInputNames().includes(binding.targetInput)) {
        throw new InvariantViolationError(
          `Binding references missing input "${binding.targetInput}" on node "${targetNode.id}"`,
        );
      }
      coverage.get(binding.targetNodeId).add(binding.targetInput);
    }

    for (const node of this.nodes) {
      const requiredInputs = node.getRequiredInputs();
      if (requiredInputs.length === 0) continue;
      const satisfied = coverage.get(node.id) ?? new Set();
      const missing = requiredInputs.filter((inputName) => !satisfied.has(inputName));
      if (missing.length > 0) {
        throw new InvariantViolationError(
          `Node "${node.id}" has unresolved inputs: ${missing.join(', ')}`,
        );
      }
    }
  }

  getNode(nodeId) {
    return this.nodesById.get(nodeId) ?? null;
  }

  getIncomingEdges(nodeId) {
    return [...(this.edgesByTarget.get(nodeId) ?? [])];
  }

  getOutgoingEdges(nodeId) {
    return [...(this.edgesBySource.get(nodeId) ?? [])];
  }

  getStartNodes() {
    return this.startNodeIds.map((nodeId) => this.nodesById.get(nodeId));
  }

  getEndNodes() {
    return this.endNodeIds.map((nodeId) => this.nodesById.get(nodeId));
  }
}
