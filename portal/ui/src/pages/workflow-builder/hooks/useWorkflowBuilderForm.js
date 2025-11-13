import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import GraphCore from "../../../workflow-graph/graph-core.js";

export function useWorkflowBuilderForm(workflow) {
  const graphCore = useMemo(() => new GraphCore(), []);

  useEffect(() => {
    graphCore.load(workflow);
  }, [graphCore, workflow]);

  const snapshot = useSyncExternalStore(
    (listener) => graphCore.subscribe(listener),
    () => graphCore.getSnapshot(),
  );

  const syncFromWorkflow = useCallback(
    (nextWorkflow, options = {}) => graphCore.load(nextWorkflow, options),
    [graphCore],
  );

  const handleMetaChange = useCallback(
    (field) => (event) => {
      graphCore.handleMetaChange(field, event.target.value);
    },
    [graphCore],
  );

  const handleStartChange = useCallback(
    (event) => {
      graphCore.handleStartChange(event.target.value);
    },
    [graphCore],
  );

  const handleAddNode = useCallback(() => graphCore.addNode(), [graphCore]);
  const handleRemoveNode = useCallback(
    (index) => graphCore.removeNode(index),
    [graphCore],
  );
  const handleSelectNode = useCallback(
    (index) => graphCore.selectNode(index),
    [graphCore],
  );
  const handleNodeChange = useCallback(
    (index, updates) => graphCore.updateNode(index, updates),
    [graphCore],
  );
  const replaceEdgesForNode = useCallback(
    (nodeKey, builder) => graphCore.replaceEdgesForNode(nodeKey, builder),
    [graphCore],
  );
  const replaceStreamsForNode = useCallback(
    (nodeKey, builder) => graphCore.replaceStreamsForNode(nodeKey, builder),
    [graphCore],
  );

  return {
    form: snapshot.form,
    selectedIndex: snapshot.selectedIndex,
    selectedNode: snapshot.selectedNode,
    handleMetaChange,
    handleStartChange,
    handleAddNode,
    handleRemoveNode,
    handleSelectNode,
    handleNodeChange,
    replaceEdgesForNode,
    replaceStreamsForNode,
    syncFromWorkflow,
    graphCore,
  };
}
