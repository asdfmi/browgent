import NodeFactory from "../factories/node-factory.js";
import Edge from "../value-objects/edge.js";
import Stream from "../value-objects/stream.js";
import { assertInvariant, requireNonEmptyString } from "../utils/validation.js";
import { stableStringify } from "../utils/object-utils.js";
import { hasCycle, computeDegrees } from "../utils/graph.js";
import { InvariantViolationError } from "../errors.js";

function routeKey(edge) {
  const conditionKey = edge.condition
    ? stableStringify({
        type: edge.condition.type,
        expression: edge.condition.expression,
        parameters: edge.condition.parameters,
      })
    : "no-condition";
  return `${edge.from}->${edge.to}:${conditionKey}`;
}

export default class Workflow {
  constructor({ id, name, nodes = [], edges = [], streams = [] }) {
    this.id = requireNonEmptyString(id, "Workflow.id");
    this.name = requireNonEmptyString(name, "Workflow.name");

    if (!Array.isArray(nodes)) {
      throw new InvariantViolationError("Workflow.nodes must be an array");
    }
    this.nodes = nodes.map((node) => NodeFactory.create(node));
    assertInvariant(
      this.nodes.length > 0,
      "Workflow must declare at least one node",
    );
    this.nodesById = new Map(this.nodes.map((node) => [node.id, node]));
    assertInvariant(
      this.nodesById.size === this.nodes.length,
      "Workflow node ids must be unique",
    );

    if (!Array.isArray(edges)) {
      throw new InvariantViolationError("Workflow.edges must be an array");
    }
    this.edges = edges.map((edge) => Edge.from(edge));
    if (!Array.isArray(streams)) {
      throw new InvariantViolationError("Workflow.streams must be an array");
    }
    this.streams = streams.map((stream) => Stream.from(stream));

    this.edgesBySource = new Map();
    this.edgesByTarget = new Map();
    this.#buildEdgeIndexes();
    this.#validateEdges();
    this.#validateGraph();
    this.#validateStreams();
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
      throw new InvariantViolationError(
        "Workflow must be a DAG (no cycles allowed)",
      );
    }
    const { inDegree, outDegree } = computeDegrees(nodeIds, this.edges);
    this.startNodeIds = nodeIds.filter((id) => inDegree.get(id) === 0);
    this.endNodeIds = nodeIds.filter((id) => outDegree.get(id) === 0);
    assertInvariant(
      this.startNodeIds.length > 0,
      "Workflow must expose at least one start node",
    );
    assertInvariant(
      this.endNodeIds.length > 0,
      "Workflow must expose at least one end node",
    );
  }

  #validateStreams() {
    const coverage = new Map();
    for (const node of this.nodes) {
      coverage.set(node.id, new Set());
    }
    for (const stream of this.streams) {
      const sourceNode = this.nodesById.get(stream.fromNodeId);
      if (!sourceNode) {
        throw new InvariantViolationError(
          `Stream references unknown source node "${stream.fromNodeId}"`,
        );
      }
      const targetNode = this.nodesById.get(stream.toNodeId);
      if (!targetNode) {
        throw new InvariantViolationError(
          `Stream references unknown target node "${stream.toNodeId}"`,
        );
      }
      if (stream.fromNodeId === stream.toNodeId) {
        throw new InvariantViolationError(
          `Stream on node "${targetNode.id}" cannot reference itself`,
        );
      }
      const bucket = coverage.get(stream.toNodeId) ?? new Set();
      if (bucket.has(stream.fromNodeId)) {
        throw new InvariantViolationError(
          `Node "${targetNode.id}" already receives data from "${stream.fromNodeId}"`,
        );
      }
      bucket.add(stream.fromNodeId);
      coverage.set(stream.toNodeId, bucket);
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

  getNodes() {
    return [...this.nodes];
  }

  getStreams() {
    return [...this.streams];
  }
}
