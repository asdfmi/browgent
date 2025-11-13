import {
  createEmptyNode,
  toEditableStream,
  toEditableEdge,
  toEditableNode,
} from "../pages/workflow-builder/utils/workflowBuilder.js";

const NODE_WIDTH = 184;

const EMPTY_FORM = {
  title: "",
  description: "",
  startNodeId: "",
  nodes: [],
  edges: [],
  streams: [],
};

const GRAPH_CHANGED_EVENT = "graph:changed";
const GRAPH_VIEW_CHANGED_EVENT = "graph:view-changed";

export default class GraphCore extends EventTarget {
  constructor(initialWorkflow = null) {
    super();
    this.state = { ...EMPTY_FORM };
    this.selectedIndex = -1;
    this.nodePositions = new Map();
    this.lastSync = { id: null, updatedAt: null };
    this.version = 0;
    this.snapshot = this.#buildSnapshot();
    this.viewCache = null;
    this.viewportSize = { width: 1280, height: 720 };
    this.constrainToViewport = false;
    if (initialWorkflow) {
      this.load(initialWorkflow, { force: true });
    }
  }

  updateViewportSize(size = {}) {
    const width = Number(size.width);
    const height = Number(size.height);
    const nextWidth =
      Number.isFinite(width) && width > 0 ? width : this.viewportSize.width;
    const nextHeight =
      Number.isFinite(height) && height > 0 ? height : this.viewportSize.height;
    if (
      nextWidth === this.viewportSize.width &&
      nextHeight === this.viewportSize.height
    ) {
      return;
    }
    this.viewportSize = { width: nextWidth, height: nextHeight };
    this.#ensurePositions(this.state.nodes, { clampOnly: true });
    this.#emitViewChanged();
  }

  subscribe(listener) {
    const handler = () => listener();
    this.addEventListener(GRAPH_CHANGED_EVENT, handler);
    return () => this.removeEventListener(GRAPH_CHANGED_EVENT, handler);
  }

  subscribeView(listener) {
    const handler = () => listener();
    this.addEventListener(GRAPH_VIEW_CHANGED_EVENT, handler);
    return () => this.removeEventListener(GRAPH_VIEW_CHANGED_EVENT, handler);
  }

  getSnapshot() {
    return this.snapshot;
  }

  getViewState() {
    if (!this.viewCache) {
      this.viewCache = this.#buildViewState();
    }
    return this.viewCache;
  }

  load(nextWorkflow, options = {}) {
    if (!nextWorkflow) return this.state;
    const { preserveSelection = false, force = false } = options;
    const last = this.lastSync;
    if (
      !force &&
      last.id === nextWorkflow.id &&
      last.updatedAt === nextWorkflow.updatedAt
    ) {
      return this.state;
    }

    const nodes = Array.isArray(nextWorkflow.nodes)
      ? nextWorkflow.nodes.map(toEditableNode)
      : [];

    const edges = Array.isArray(nextWorkflow.edges)
      ? nextWorkflow.edges.map(toEditableEdge)
      : [];
    const streams = Array.isArray(nextWorkflow.streams)
      ? nextWorkflow.streams.map(toEditableStream).filter(Boolean)
      : [];

    this.lastSync = {
      id: nextWorkflow.id ?? null,
      updatedAt: nextWorkflow.updatedAt ?? null,
    };
    const startNodeId = nextWorkflow.startNodeId ?? nodes[0]?.nodeKey ?? "";
    this.state = {
      title: nextWorkflow.title ?? "",
      description: nextWorkflow.description ?? "",
      startNodeId,
      nodes,
      edges,
      streams,
    };
    if (nodes.length === 0) {
      this.selectedIndex = -1;
    } else if (preserveSelection && this.selectedIndex >= 0) {
      this.selectedIndex = Math.min(this.selectedIndex, nodes.length - 1);
    } else {
      this.selectedIndex = 0;
    }
    this.#hydratePositionsFromNodes(nodes);
    this.#ensurePositions(nodes);
    this.#commit({ viewChanged: true });
    return this.state;
  }

  handleMetaChange(field, value) {
    if (!(field in this.state)) return this.state;
    this.state = { ...this.state, [field]: value };
    this.#commit();
    return this.state;
  }

  handleStartChange(value) {
    this.state = { ...this.state, startNodeId: value };
    this.#commit({ viewChanged: true });
    return this.state;
  }

  addNode() {
    const prev = this.state;
    const newNode = createEmptyNode(prev.nodes);
    const nodes = [...prev.nodes, newNode];
    const startNodeId = prev.startNodeId || (nodes[0]?.nodeKey ?? "");
    let edges = prev.edges;
    if (prev.nodes.length > 0) {
      const sourceKey = prev.nodes[prev.nodes.length - 1]?.nodeKey?.trim();
      const targetKey = newNode.nodeKey?.trim();
      if (sourceKey && targetKey) {
        const edgeKey = globalThis.crypto.randomUUID();
        const autoEdge = {
          edgeKey,
          sourceKey,
          targetKey,
          label: "",
          condition: null,
          metadata: null,
          priority: prev.edges.length,
        };
        edges = [...prev.edges, autoEdge];
      }
    }
    this.state = { ...prev, nodes, edges, startNodeId };
    this.selectedIndex = nodes.length - 1;
    this.#ensurePositions(nodes);
    this.#commit({ viewChanged: true });
    return this.state;
  }

  removeNode(index) {
    if (index < 0 || index >= this.state.nodes.length) {
      return this.state;
    }
    const prev = this.state;
    const node = prev.nodes[index];
    const nodeKey = node?.nodeKey;
    const nodes = prev.nodes.filter((_, i) => i !== index);
    const edges = prev.edges.filter(
      (edge) => edge.sourceKey !== nodeKey && edge.targetKey !== nodeKey,
    );
    const streams = prev.streams.filter(
      (stream) => stream.sourceKey !== nodeKey && stream.targetKey !== nodeKey,
    );
    const startNodeId =
      nodeKey === prev.startNodeId
        ? (nodes[0]?.nodeKey ?? "")
        : prev.startNodeId;
    if (nodes.length === 0) {
      this.selectedIndex = -1;
    } else if (this.selectedIndex > index) {
      this.selectedIndex -= 1;
    } else if (this.selectedIndex === index) {
      this.selectedIndex = Math.min(index, nodes.length - 1);
    }
    this.state = { ...prev, nodes, edges, streams, startNodeId };
    this.#ensurePositions(nodes);
    this.#commit({ viewChanged: true });
    return this.state;
  }

  selectNode(index) {
    const nextIndex = typeof index === "number" ? index : -1;
    const clamped =
      nextIndex >= 0 && nextIndex < this.state.nodes.length ? nextIndex : -1;
    if (clamped === this.selectedIndex) {
      return this.state;
    }
    this.selectedIndex = clamped;
    this.#commit();
    return this.state;
  }

  selectNodeByKey(nodeKey) {
    if (!nodeKey) {
      this.selectNode(-1);
      return;
    }
    const index = this.state.nodes.findIndex(
      (node) => node.nodeKey === nodeKey,
    );
    this.selectNode(index);
  }

  updateNode(index, updates) {
    if (index < 0 || index >= this.state.nodes.length) {
      return this.state;
    }
    const prev = this.state;
    const currentNode = prev.nodes[index];
    let nextNode = { ...currentNode, ...updates };
    let streams = prev.streams;
    const typeChanged =
      typeof updates.type === "string" && updates.type !== currentNode.type;
    if (typeChanged) {
      streams = streams.filter(
        (stream) =>
          stream.sourceKey !== currentNode.nodeKey &&
          stream.targetKey !== currentNode.nodeKey,
      );
    }
    const nodes = prev.nodes.map((node, i) => (i === index ? nextNode : node));
    let startNodeId = prev.startNodeId;
    if (currentNode.nodeKey === prev.startNodeId && nextNode.nodeKey) {
      startNodeId = nextNode.nodeKey;
    }
    let edges = prev.edges;
    const currentKey = currentNode.nodeKey;
    const nextKey = nextNode.nodeKey;
    if (currentKey && nextKey && currentKey !== nextKey) {
      edges = prev.edges.map((edge) => {
        if (!edge) return edge;
        let changed = false;
        const updated = { ...edge };
        if (edge.sourceKey === currentKey) {
          updated.sourceKey = nextKey;
          changed = true;
        }
        if (edge.targetKey === currentKey) {
          updated.targetKey = nextKey;
          changed = true;
        }
        return changed ? updated : edge;
      });
      const position = this.nodePositions.get(currentKey);
      if (position) {
        this.nodePositions.set(nextKey, position);
        this.nodePositions.delete(currentKey);
      }
      streams = streams.map((stream) => {
        if (!stream) return stream;
        let changed = false;
        const updated = { ...stream };
        if (stream.sourceKey === currentKey) {
          updated.sourceKey = nextKey;
          changed = true;
        }
        if (stream.targetKey === currentKey) {
          updated.targetKey = nextKey;
          changed = true;
        }
        return changed ? updated : stream;
      });
    }
    this.state = { ...prev, nodes, edges, streams, startNodeId };
    this.#ensurePositions(nodes);
    this.#commit({ viewChanged: true });
    return this.state;
  }

  replaceEdgesForNode(nodeKey, builder) {
    if (!nodeKey) return this.state;
    const prev = this.state;
    const existing = prev.edges.filter((edge) => edge.sourceKey === nodeKey);
    const nextNodeEdgesRaw = builder(existing, prev) || [];
    const nextNodeEdges = nextNodeEdgesRaw.filter(Boolean).map((edge) => ({
      edgeKey: String(edge.edgeKey || "").trim(),
      sourceKey: nodeKey,
      targetKey: String(
        typeof edge.targetKey === "string"
          ? edge.targetKey
          : typeof edge.target === "string"
            ? edge.target
            : "",
      ).trim(),
      label: edge.label ?? "",
      condition:
        edge.condition && typeof edge.condition === "object"
          ? edge.condition
          : null,
      metadata:
        edge.metadata && typeof edge.metadata === "object"
          ? edge.metadata
          : null,
      priority: typeof edge.priority === "number" ? edge.priority : null,
    }));
    const remainder = prev.edges.filter((edge) => edge.sourceKey !== nodeKey);
    this.state = { ...prev, edges: [...remainder, ...nextNodeEdges] };
    this.#commit({ viewChanged: true });
    return this.state;
  }

  replaceStreamsForNode(nodeKey, builder) {
    if (!nodeKey) return this.state;
    const prev = this.state;
    const existing = prev.streams.filter(
      (stream) => stream.targetKey === nodeKey,
    );
    const nextStreamsRaw = builder(existing, prev) || [];
    const sanitized = nextStreamsRaw
      .filter((stream) => stream && stream.targetKey === nodeKey)
      .map((stream) => {
        const streamKey =
          typeof stream.streamKey === "string" && stream.streamKey.trim()
            ? stream.streamKey.trim()
            : globalThis.crypto.randomUUID();
        return {
          streamKey,
          sourceKey: String(stream.sourceKey || "").trim(),
          targetKey: nodeKey,
        };
      })
      .filter((stream) => stream.sourceKey);
    const remainder = prev.streams.filter(
      (stream) => stream.targetKey !== nodeKey,
    );
    this.state = {
      ...prev,
      streams: [...remainder, ...sanitized],
    };
    this.#commit();
    return this.state;
  }

  updateNodePosition(nodeKey, position) {
    if (!nodeKey || !position) return;
    const { x, y } = position;
    const rounded = {
      x: Number.isFinite(x) ? Math.round(x) : 0,
      y: Number.isFinite(y) ? Math.round(y) : 0,
    };
    const clamped = this.#clampPosition(rounded);
    const previous = this.nodePositions.get(nodeKey) || { x: 0, y: 0 };
    if (previous.x === clamped.x && previous.y === clamped.y) {
      return;
    }
    this.nodePositions.set(nodeKey, clamped);
    this.#syncNodePositionFields();
    this.#commit({ viewChanged: true });
  }

  sendIntent(intent) {
    if (!intent || typeof intent !== "object") return;
    switch (intent.type) {
      case "select-node":
        this.selectNodeByKey(intent.nodeKey);
        break;
      case "move-node":
        if (intent.nodeKey && intent.position) {
          this.updateNodePosition(intent.nodeKey, intent.position);
        }
        break;
      default:
        break;
    }
  }

  #ensurePositions(nodes, { clampOnly = false } = {}) {
    const seen = new Set();
    nodes.forEach((node, index) => {
      const key = node?.nodeKey || node?.id;
      if (!key) return;
      seen.add(key);
      const current = this.nodePositions.get(key);
      if (!current || clampOnly) {
        const base = current ?? this.#createDefaultPosition(index);
        this.nodePositions.set(key, this.#clampPosition(base));
      }
    });
    for (const key of Array.from(this.nodePositions.keys())) {
      if (!seen.has(key)) {
        this.nodePositions.delete(key);
      }
    }
    this.#syncNodePositionFields(nodes);
    this.viewCache = null;
  }

  #createDefaultPosition(index) {
    const width = this.viewportSize?.width ?? 1280;
    const height = this.viewportSize?.height ?? 720;
    const leftSafe = Math.min(560, Math.max(80, width * 0.35));
    const rightSafe = Math.min(420, Math.max(80, width * 0.3));
    const topSafe = Math.min(220, Math.max(80, height * 0.25));
    const bottomSafe = Math.min(240, Math.max(80, height * 0.25));
    const usableWidth = Math.max(240, width - leftSafe - rightSafe);
    const usableHeight = Math.max(200, height - topSafe - bottomSafe);
    const columns = Math.max(1, Math.floor(usableWidth / 240));
    const column = index % columns;
    const row = Math.floor(index / columns);
    const spacingX = usableWidth / columns;
    const spacingY = Math.max(
      180,
      usableHeight / Math.max(1, Math.floor(usableHeight / 180)),
    );
    const baseX = leftSafe + spacingX * column + spacingX / 2 - NODE_WIDTH / 2;
    const baseY = topSafe + row * spacingY;
    return {
      x: Math.round(baseX),
      y: Math.round(baseY),
    };
  }

  #getNodePosition(nodeKey, index) {
    if (!nodeKey) {
      return this.#clampPosition(this.#createDefaultPosition(index));
    }
    const position = this.nodePositions.get(nodeKey);
    if (position) return position;
    const nextPosition = this.#clampPosition(
      this.#createDefaultPosition(index),
    );
    this.nodePositions.set(nodeKey, nextPosition);
    return nextPosition;
  }

  #hydratePositionsFromNodes(nodes) {
    this.nodePositions.clear();
    nodes.forEach((node, index) => {
      const key = node?.nodeKey || node?.id;
      if (!key) return;
      if (
        typeof node.positionX === "number" &&
        typeof node.positionY === "number"
      ) {
        this.nodePositions.set(
          key,
          this.#clampPosition({ x: node.positionX, y: node.positionY }),
        );
      } else {
        const fallback = this.#createDefaultPosition(index);
        this.nodePositions.set(key, this.#clampPosition(fallback));
      }
    });
  }

  #syncNodePositionFields(nodesOverride) {
    const sourceNodes = nodesOverride ?? this.state.nodes;
    if (!Array.isArray(sourceNodes)) return;
    let changed = false;
    const updatedNodes = sourceNodes.map((node, index) => {
      const key = node?.nodeKey || node?.id || `node_${index}`;
      const position = this.#getNodePosition(key, index);
      const currentX =
        typeof node.positionX === "number" ? node.positionX : null;
      const currentY =
        typeof node.positionY === "number" ? node.positionY : null;
      if (currentX === position.x && currentY === position.y) {
        return node;
      }
      changed = true;
      return { ...node, positionX: position.x, positionY: position.y };
    });
    if (changed) {
      this.state = { ...this.state, nodes: updatedNodes };
    } else if (nodesOverride && nodesOverride !== this.state.nodes) {
      this.state = { ...this.state, nodes: updatedNodes };
    }
  }

  #clampPosition(position) {
    const fallback = { x: 32, y: 32 };
    const base = {
      x: Number.isFinite(position?.x) ? position.x : fallback.x,
      y: Number.isFinite(position?.y) ? position.y : fallback.y,
    };
    if (!this.constrainToViewport) {
      return base;
    }
    const width = this.viewportSize?.width ?? 1280;
    const height = this.viewportSize?.height ?? 720;
    const maxX = Math.max(32, width - 220);
    const maxY = Math.max(32, height - 140);
    return {
      x: Math.min(Math.max(base.x, 32), maxX),
      y: Math.min(Math.max(base.y, 32), maxY),
    };
  }

  #buildSnapshot() {
    return {
      version: this.version,
      form: this.state,
      selectedIndex: this.selectedIndex,
      selectedNode:
        this.selectedIndex >= 0
          ? (this.state.nodes[this.selectedIndex] ?? null)
          : null,
    };
  }

  #buildViewState() {
    const nodes = this.state.nodes.map((node, index) => ({
      nodeKey: node.nodeKey,
      label: node.label || node.nodeKey || `Node ${index + 1}`,
      type: node.type || "navigate",
      position: this.#getNodePosition(node.nodeKey, index),
      config: node.config || null,
    }));
    const edges = this.state.edges.map((edge, index) => ({
      edgeKey: edge.edgeKey || edge.id || `edge_${index + 1}`,
      sourceKey: edge.sourceKey ?? edge.source ?? edge.from ?? "",
      targetKey: edge.targetKey ?? edge.target ?? edge.to ?? "",
    }));
    return {
      version: this.version,
      nodes,
      edges,
      selectedNodeKey: this.state.nodes[this.selectedIndex]?.nodeKey ?? null,
    };
  }

  #commit({ viewChanged = false } = {}) {
    this.version += 1;
    this.snapshot = this.#buildSnapshot();
    this.dispatchEvent(
      new CustomEvent(GRAPH_CHANGED_EVENT, {
        detail: { version: this.version },
      }),
    );
    if (viewChanged) {
      this.#emitViewChanged();
    } else {
      this.viewCache = null;
    }
    return this.state;
  }

  #emitViewChanged() {
    this.viewCache = null;
    this.dispatchEvent(
      new CustomEvent(GRAPH_VIEW_CHANGED_EVENT, {
        detail: { version: this.version },
      }),
    );
  }
}
