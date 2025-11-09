export function buildAdjacency(nodeIds, edges) {
  const adjacency = new Map();
  for (const id of nodeIds) {
    adjacency.set(id, new Set());
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) continue;
    if (edge.to && adjacency.has(edge.to)) {
      adjacency.get(edge.from).add(edge.to);
    }
  }
  return adjacency;
}

export function hasCycle(nodeIds, edges) {
  const adjacency = buildAdjacency(nodeIds, edges);
  const states = new Map(); // 0=unvisited,1=visiting,2=done
  for (const id of nodeIds) {
    states.set(id, 0);
  }

  const visit = (nodeId) => {
    const state = states.get(nodeId);
    if (state === 1) return true;
    if (state === 2) return false;
    states.set(nodeId, 1);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (visit(neighbor)) return true;
    }
    states.set(nodeId, 2);
    return false;
  };

  for (const id of nodeIds) {
    if (visit(id)) {
      return true;
    }
  }
  return false;
}

export function computeDegrees(nodeIds, edges) {
  const inDegree = new Map();
  const outDegree = new Map();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }
  for (const edge of edges) {
    if (outDegree.has(edge.from)) {
      outDegree.set(edge.from, outDegree.get(edge.from) + 1);
    }
    if (edge.to && inDegree.has(edge.to)) {
      inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    }
  }
  return { inDegree, outDegree };
}
