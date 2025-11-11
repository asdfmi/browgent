import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import ExecutionViewerModal from "../../../components/ExecutionViewerModal.jsx";
import { useWorkflowRun } from "../../../hooks/useWorkflowRun.js";
import NodeDetailPanel from "./NodeDetailPanel.jsx";
import WorkflowRunHistory from "./WorkflowRunHistory.jsx";
import { useWorkflowBuilderForm } from "../hooks/useWorkflowBuilderForm.js";
import {
  buildPayload,
  formatApiError,
  getBuilderContext,
} from "../utils/workflowBuilder.js";
import GraphViewport from "./GraphViewport.jsx";
import { HttpError } from "../../../api/client.js";
import {
  createWorkflow as createWorkflowApi,
  listWorkflowRuns,
  updateWorkflow as updateWorkflowApi,
} from "../../../api/workflows.js";

export default function WorkflowBuilderPage() {
  const builderContext = useMemo(
    () => getBuilderContext(window.location.pathname),
    [],
  );
  const [workflowId, setWorkflowId] = useState(
    builderContext.workflowId ?? null,
  );
  const isNewWorkflow = !workflowId;
  const {
    workflowState,
    runState,
    wsStatus,
    eventLog,
    screenshot,
    currentStepIndex,
    handleRun,
    reloadWorkflow,
  } = useWorkflowRun(workflowId, { enabled: Boolean(workflowId) });

  const {
    form,
    selectedIndex,
    selectedNode,
    handleMetaChange,
    handleStartChange,
    handleAddNode,
    handleRemoveNode,
    handleNodeChange,
    replaceEdgesForNode,
    syncFromWorkflow,
    graphCore,
  } = useWorkflowBuilderForm(workflowState.data);
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [runsState, setRunsState] = useState({
    loading: true,
    data: [],
    error: "",
  });
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const hydratingRef = useRef(true);
  const latestFormRef = useRef(form);
  const lastSavedSnapshotRef = useRef(JSON.stringify(form));

  const isLoading = workflowState.loading && !workflowState.data;
  const loadError = workflowState.error;
  const runError = runState.error;
  const viewerNodes = useMemo(() => form.nodes, [form.nodes]);
  const canDeleteNode = selectedIndex >= 0 && form.nodes.length > 1;

  const metaTitleChange = handleMetaChange("title");
  const metaDescriptionChange = handleMetaChange("description");

  const applyWorkflowData = useCallback(
    (data, options = {}) => {
      if (!data) return;
      hydratingRef.current = true;
      syncFromWorkflow(data, {
        preserveSelection: true,
        force: true,
        ...options,
      });
    },
    [syncFromWorkflow],
  );

  const persistWorkflow = useCallback(
    async (formOverride, { silent = false } = {}) => {
      const targetForm = formOverride ?? latestFormRef.current;
      if (!targetForm) return false;
      setSaving(true);
      if (!silent) setSaveError("");
      try {
        const payload = buildPayload(targetForm);
        if (!workflowId) {
          const response = await createWorkflowApi(payload);
          const workflowData = response?.data;
          if (workflowData?.id) {
            setWorkflowId(workflowData.id);
            window.history.replaceState(
              null,
              "",
              `/workflow/${encodeURIComponent(String(workflowData.id))}`,
            );
          }
          if (workflowData) {
            applyWorkflowData(workflowData);
            setSaveError("");
            lastSavedSnapshotRef.current = JSON.stringify(targetForm);
            latestFormRef.current = targetForm;
            setHasPendingChanges(false);
            return true;
          }
          throw new Error("Failed to create workflow");
        }
        const response = await updateWorkflowApi(workflowId, payload);
        const workflowData = response?.data;
        if (workflowData) {
          applyWorkflowData(workflowData);
          setSaveError("");
          lastSavedSnapshotRef.current = JSON.stringify(targetForm);
          latestFormRef.current = targetForm;
          setHasPendingChanges(false);
          return true;
        }
        const refreshed = await reloadWorkflow();
        if (refreshed?.ok && refreshed.data) {
          applyWorkflowData(refreshed.data);
          setSaveError("");
          lastSavedSnapshotRef.current = JSON.stringify(targetForm);
          latestFormRef.current = targetForm;
          setHasPendingChanges(false);
          return true;
        }
        const fallbackError = refreshed?.error || "Failed to refresh workflow";
        setSaveError(fallbackError);
        return false;
      } catch (error) {
        if (error instanceof HttpError) {
          const formatted = formatApiError(
            error.data && typeof error.data === "object"
              ? error.data
              : { error: error.message },
          );
          setSaveError(formatted);
        } else {
          const message =
            error instanceof Error ? error.message : "Failed to save workflow";
          setSaveError(message);
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [workflowId, applyWorkflowData, reloadWorkflow, setSaveError, setSaving],
  );

  const fetchRuns = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!workflowId) {
        setRunsState({ loading: false, data: [], error: "" });
        return;
      }
      if (!silent) {
        setRunsState((prev) => ({ ...prev, loading: true, error: "" }));
      }
      try {
        const payload = await listWorkflowRuns(
          workflowId,
          signal ? { signal } : undefined,
        );
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setRunsState({ loading: false, data: rows, error: "" });
      } catch (error) {
        if (signal?.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load workflow runs";
        setRunsState({ loading: false, data: [], error: message });
      }
    },
    [workflowId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchRuns({ signal: controller.signal, silent: false });
    return () => controller.abort();
  }, [fetchRuns]);

  const handleDeleteSelectedNode = useCallback(async () => {
    if (selectedIndex < 0) return;
    const node = form.nodes[selectedIndex];
    const label = node?.label || node?.nodeKey || `node ${selectedIndex + 1}`;
    if (!window.confirm(`Delete ${label}?`)) return;
    const nextForm = handleRemoveNode(selectedIndex);
    if (!nextForm) return;
    latestFormRef.current = nextForm;
    await persistWorkflow(nextForm);
  }, [form.nodes, handleRemoveNode, persistWorkflow, selectedIndex]);

  const handleAddNodeAndEdit = useCallback(() => {
    const nextForm = handleAddNode();
    if (nextForm) {
      latestFormRef.current = nextForm;
    }
    setSaveError("");
  }, [handleAddNode]);

  const handleNodePartialChange = useCallback(
    (updates) => {
      if (selectedIndex < 0) return;
      setSaveError("");
      const nextForm = handleNodeChange(selectedIndex, updates);
      if (nextForm) {
        latestFormRef.current = nextForm;
      }
    },
    [selectedIndex, handleNodeChange],
  );

  const handleRefreshWorkflow = useCallback(() => {
    if (!workflowId) return;
    reloadWorkflow().then((result) => {
      if (result?.ok && result.data) {
        applyWorkflowData(result.data, {
          preserveSelection: true,
          force: true,
        });
      }
    });
  }, [workflowId, reloadWorkflow, applyWorkflowData]);

  useEffect(() => {
    latestFormRef.current = form;
    if (hydratingRef.current) {
      lastSavedSnapshotRef.current = JSON.stringify(form);
      setHasPendingChanges(false);
      hydratingRef.current = false;
    } else {
      const snapshotString = JSON.stringify(form);
      setHasPendingChanges(snapshotString !== lastSavedSnapshotRef.current);
    }
  }, [form]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasPendingChanges || isSaving) {
        event.preventDefault();
        event.returnValue = "Changes you made may not be saved.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingChanges, isSaving]);

  const onRun = useCallback(async () => {
    if (!workflowId) return;
    setViewerOpen(true);
    const result = await handleRun();
    if (!result?.ok) {
      setViewerOpen(false);
    }
    fetchRuns({ silent: true });
  }, [handleRun, workflowId, fetchRuns]);

  const selectedNodeKey = selectedNode?.nodeKey ?? "";
  const nodeEdges = useMemo(() => {
    if (!selectedNodeKey) return [];
    return form.edges.filter((edge) => edge.sourceKey === selectedNodeKey);
  }, [form.edges, selectedNodeKey]);

  const handleNodeEdgesChange = useCallback(
    (nextEdges) => {
      if (!selectedNodeKey) return;
      setSaveError("");
      const nextForm = replaceEdgesForNode(selectedNodeKey, () => nextEdges);
      if (nextForm) {
        latestFormRef.current = nextForm;
      }
    },
    [replaceEdgesForNode, selectedNodeKey],
  );

  const handleRefreshRuns = useCallback(() => {
    fetchRuns({});
  }, [fetchRuns]);

  useEffect(() => {
    if (workflowState.data) {
      hydratingRef.current = true;
    }
  }, [workflowState.data]);

  const handleSave = useCallback(async () => {
    if (!hasPendingChanges) return;
    await persistWorkflow();
  }, [hasPendingChanges, persistWorkflow]);

  if (isLoading) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography>Loading...</Typography>
        </Stack>
      </Box>
    );
  }

  if (loadError && !workflowState.data) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pb: { xs: 3, md: 0 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      >
        <GraphViewport graphCore={graphCore} />
      </Box>

      <Box
        sx={{
          position: { xs: "relative", lg: "absolute" },
          top: { lg: 24 },
          left: { lg: 24 },
          width: { xs: "100%", sm: 420 },
          maxWidth: 480,
          zIndex: 1,
          pointerEvents: "auto",
          px: { xs: 2, lg: 0 },
          mb: { xs: 2, lg: 0 },
        }}
      >
        <Paper
          elevation={4}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            maxHeight: { xs: "none", lg: "70vh" },
            overflow: "auto",
          }}
        >
          <Stack spacing={2}>
            <Stack spacing={1}>
              <TextField
                label="Workflow title"
                value={form.title}
                onChange={(event) => {
                  setSaveError("");
                  metaTitleChange(event);
                }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isSaving || !hasPendingChanges}
                >
                  Save
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={onRun}
                  disabled={
                    !workflowId ||
                    runState.status === "starting" ||
                    runState.status === "queued"
                  }
                >
                  Run
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setViewerOpen(true)}
                  disabled={!workflowId}
                >
                  Viewer
                </Button>
              </Stack>
            </Stack>

            <TextField
              label="Description"
              value={form.description}
              onChange={(event) => {
                setSaveError("");
                metaDescriptionChange(event);
              }}
              multiline
              minRows={2}
            />

            <Stack spacing={1}>
              <TextField
                select
                label="Start node"
                value={form.startNodeId}
                onChange={(event) => {
                  setSaveError("");
                  handleStartChange(event);
                }}
              >
                {form.nodes.map((node) => (
                  <MenuItem key={node.nodeKey} value={node.nodeKey}>
                    {node.label || node.nodeKey}
                  </MenuItem>
                ))}
                {form.nodes.length === 0 ? (
                  <MenuItem value="">No nodes</MenuItem>
                ) : null}
              </TextField>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button onClick={handleAddNodeAndEdit}>Add node</Button>
                <Button
                  onClick={handleDeleteSelectedNode}
                  disabled={!canDeleteNode}
                >
                  Delete node
                </Button>
                <Button
                  onClick={() => {
                    handleRefreshWorkflow();
                    handleRefreshRuns();
                  }}
                  disabled={!workflowId}
                >
                  Refresh
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Run: ${runState.status}`} />
              <Chip label={`WS: ${wsStatus}`} />
              <Chip label={`Nodes: ${form.nodes.length}`} />
              {hasPendingChanges ? <Chip label="Unsaved" /> : null}
            </Stack>

            {isNewWorkflow ? (
              <Alert severity="info">
                This workflow is not saved yet. Add nodes and press Save to
                create it.
              </Alert>
            ) : null}

            {runError || saveError || (loadError && workflowState.data) ? (
              <Stack spacing={1}>
                {runError ? <Alert severity="error">{runError}</Alert> : null}
                {saveError ? (
                  <Alert severity="error">
                    {saveError.split(/\n+/).map((line, index) => (
                      <Typography key={`${line}-${index}`}>{line}</Typography>
                    ))}
                  </Alert>
                ) : null}
                {loadError && workflowState.data ? (
                  <Alert severity="warning">{loadError}</Alert>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Box>

      <Box
        sx={{
          position: { xs: "relative", lg: "absolute" },
          top: { lg: 24 },
          right: { lg: 24 },
          bottom: { lg: 24 },
          width: { xs: "100%", lg: 380 },
          maxWidth: 420,
          zIndex: 1,
          pointerEvents: "auto",
          px: { xs: 2, lg: 0 },
        }}
      >
        <Paper
          elevation={4}
          sx={{
            p: 2,
            height: { xs: "auto", lg: "100%" },
            overflow: "auto",
          }}
        >
          <NodeDetailPanel
            node={selectedNode}
            edges={nodeEdges}
            allEdges={form.edges}
            onNodeChange={handleNodePartialChange}
            onEdgesChange={handleNodeEdgesChange}
            onDelete={handleDeleteSelectedNode}
            canDelete={canDeleteNode}
            saving={isSaving}
            error={saveError}
          />
        </Paper>
      </Box>

      <Box
        sx={{
          position: { xs: "relative", lg: "absolute" },
          left: { lg: 24 },
          bottom: { lg: 24 },
          width: { xs: "100%", sm: 420 },
          maxWidth: 500,
          zIndex: 1,
          pointerEvents: "auto",
          px: { xs: 2, lg: 0 },
        }}
      >
        <Paper elevation={4} sx={{ p: 2 }}>
          <WorkflowRunHistory
            runs={runsState.data}
            loading={runsState.loading}
            error={runsState.error}
            onRefresh={handleRefreshRuns}
          />
        </Paper>
      </Box>

      <ExecutionViewerModal
        open={isViewerOpen}
        onClose={() => setViewerOpen(false)}
        screenshot={screenshot}
        eventLog={eventLog}
        wsStatus={wsStatus}
        runState={runState}
        nodes={viewerNodes}
        currentStepIndex={currentStepIndex}
      />
    </Box>
  );
}
