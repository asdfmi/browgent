import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExecutionViewerModal from "../../../components/ExecutionViewerModal.jsx";
import { useWorkflowRun } from "../../../hooks/useWorkflowRun.js";
import StepEditor from "./StepEditor.jsx";
import WorkflowCanvas from "./WorkflowCanvas.jsx";
import { useWorkflowBuilderForm } from "../hooks/useWorkflowBuilderForm.js";
import { buildPayload, formatApiError, getBuilderContext } from "../utils/workflowBuilder.js";
import { HttpError } from "../../../api/client.js";
import { updateWorkflow as updateWorkflowApi } from "../../../api/workflows.js";

export default function WorkflowBuilderPage() {
  const { workflowId } = useMemo(() => getBuilderContext(window.location.pathname), []);
  const {
    workflowState,
    runState,
    wsStatus,
    eventLog,
    screenshot,
    currentStepIndex,
    handleRun,
    reloadWorkflow,
  } = useWorkflowRun(workflowId);

  const {
    form,
    selectedIndex,
    selectedStep,
    handleAddStep,
    handleRemoveStep,
    handleSelectStep,
    handleStepChange,
    syncFromWorkflow,
  } = useWorkflowBuilderForm(workflowState.data);
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const onRun = useCallback(async () => {
    if (!workflowId) return;
    setViewerOpen(true);
    const result = await handleRun();
    if (!result?.ok) {
      setViewerOpen(false);
    }
  }, [handleRun, workflowId]);

  const isLoading = workflowState.loading && !workflowState.data;
  const loadError = workflowState.error;
  const runError = runState.error;
  const viewerSteps = useMemo(() => form.steps, [form.steps]);
  const selectedStepKey = selectedStep?.stepKey ?? "";
  const activeStepKey = typeof currentStepIndex === "number"
    ? form.steps[currentStepIndex]?.stepKey ?? ""
    : "";
  const canDeleteStep = selectedIndex >= 0 && form.steps.length > 1;

  const openEditorForIndex = useCallback((index) => {
    if (typeof index === "number" && index >= 0) {
      handleSelectStep(index);
      setSaveError("");
      setEditorOpen(true);
    }
  }, [handleSelectStep, setEditorOpen, setSaveError]);

  const persistWorkflow = useCallback(async (nextForm) => {
    if (!workflowId || !nextForm) return false;
    setSaving(true);
    setSaveError("");
    try {
      const payload = buildPayload(nextForm);
      const response = await updateWorkflowApi(workflowId, payload);
      const workflowData = response?.data;
      if (workflowData) {
        syncFromWorkflow(workflowData, { preserveSelection: true, force: true });
        setSaveError("");
        return true;
      }
      const refreshed = await reloadWorkflow();
      if (refreshed?.ok && refreshed.data) {
        syncFromWorkflow(refreshed.data, { preserveSelection: true, force: true });
        setSaveError("");
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
            : { error: error.message }
        );
        setSaveError(formatted);
      } else {
        const message = error instanceof Error ? error.message : "Failed to save workflow";
        setSaveError(message);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [workflowId, syncFromWorkflow, reloadWorkflow, setSaveError, setSaving]);

  const handleSaveStep = useCallback(async (stepDraft) => {
    if (selectedIndex < 0) return false;
    const nextForm = handleStepChange(selectedIndex, stepDraft);
    if (!nextForm) return false;
    return persistWorkflow(nextForm);
  }, [selectedIndex, handleStepChange, persistWorkflow]);

  const handleDeleteSelectedStep = useCallback(async () => {
    if (selectedIndex < 0) return;
    const nextForm = handleRemoveStep(selectedIndex);
    if (!nextForm) return;
    const ok = await persistWorkflow(nextForm);
    if (ok) {
      setEditorOpen(false);
    }
  }, [handleRemoveStep, persistWorkflow, selectedIndex, setEditorOpen]);

  const handleAddStepAndEdit = useCallback(() => {
    handleAddStep();
    setTimeout(() => {
      setSaveError("");
      setEditorOpen(true);
    }, 0);
  }, [handleAddStep, setEditorOpen, setSaveError]);

  const handleRefreshWorkflow = useCallback(() => {
    reloadWorkflow().then((result) => {
      if (result?.ok && result.data) {
        syncFromWorkflow(result.data, { preserveSelection: true, force: true });
      }
    });
  }, [reloadWorkflow, syncFromWorkflow]);

  if (!workflowId) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
        }}
      >
        <Alert severity="error">Invalid workflow path. Please return to the list.</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (loadError && !workflowState.data) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
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
        height: "100vh",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <WorkflowCanvas
        steps={form.steps}
        selectedStepKey={selectedStepKey}
        activeStepKey={activeStepKey}
        startStepId={form.startStepId}
        onSelectStep={openEditorForIndex}
      />

      <Box
        sx={{
          position: "absolute",
          top: { xs: 12, md: 20 },
          left: { xs: 12, md: 20 },
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <Paper
          elevation={5}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2,
            pointerEvents: "auto",
            minWidth: 280,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography variant="h6" noWrap>
                {form.title || "Untitled workflow"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                #{workflowId}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" noWrap>
              Slug: {form.slug || "-"} · Steps: {form.steps.length} · Start: {form.startStepId || (form.steps[0]?.stepKey ?? "-")}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              WS: {wsStatus} · Run status: {runState.status} · Save: {isSaving ? "saving..." : "idle"}
            </Typography>
            {(runError || saveError || (loadError && workflowState.data)) ? (
              <Stack spacing={0.5}>
                {runError ? <Alert severity="error" variant="filled">{runError}</Alert> : null}
                {saveError ? <Alert severity="error" variant="filled">{saveError}</Alert> : null}
                {loadError && workflowState.data ? <Alert severity="warning" variant="filled">{loadError}</Alert> : null}
              </Stack>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={handleRefreshWorkflow}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button variant="contained" size="small" onClick={handleAddStepAndEdit}>
                New step
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={onRun}
                disabled={runState.status === "starting" || runState.status === "queued"}
              >
                Run
              </Button>
              <Button variant="outlined" size="small" onClick={() => setViewerOpen(true)}>
                Viewer
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>

      <ExecutionViewerModal
        open={isViewerOpen}
        onClose={() => setViewerOpen(false)}
        screenshot={screenshot}
        eventLog={eventLog}
        wsStatus={wsStatus}
        runState={runState}
        steps={viewerSteps}
        currentStepIndex={currentStepIndex}
      />
      <StepEditor
        open={isEditorOpen}
        step={selectedStep}
        onSave={handleSaveStep}
        onDelete={handleDeleteSelectedStep}
        canDelete={canDeleteStep}
        onClose={() => setEditorOpen(false)}
        saving={isSaving}
        error={saveError}
      />
    </Box>
  );
}
