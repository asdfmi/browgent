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
import WorkflowStepList from "./WorkflowStepList.jsx";
import StepDetailPanel from "./StepDetailPanel.jsx";
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
  const activeStepKey = typeof currentStepIndex === "number"
    ? form.steps[currentStepIndex]?.stepKey ?? ""
    : "";
  const canDeleteStep = selectedIndex >= 0 && form.steps.length > 1;

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
    const step = form.steps[selectedIndex];
    const label = step?.label || step?.stepKey || `step ${selectedIndex + 1}`;
    if (!window.confirm(`Delete ${label}?`)) return;
    const nextForm = handleRemoveStep(selectedIndex);
    if (!nextForm) return;
    await persistWorkflow(nextForm);
  }, [form.steps, handleRemoveStep, persistWorkflow, selectedIndex]);

  const handleAddStepAndEdit = useCallback(() => {
    handleAddStep();
    setSaveError("");
  }, [handleAddStep]);

  const handleRefreshWorkflow = useCallback(() => {
    reloadWorkflow().then((result) => {
      if (result?.ok && result.data) {
        syncFromWorkflow(result.data, { preserveSelection: true, force: true });
      }
    });
  }, [reloadWorkflow, syncFromWorkflow]);

  const handleSelectStepFromList = useCallback((index) => {
    setSaveError("");
    handleSelectStep(index);
  }, [handleSelectStep]);

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
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 2, md: 4 } }}>
        <Paper
          elevation={5}
          sx={{ px: 3, py: 2.5, borderRadius: 3 }}
        >
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "baseline" }}>
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

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          minHeight: 0,
          mt: { xs: 2, md: 3 },
        }}
      >
        <WorkflowStepList
          steps={form.steps}
          selectedIndex={selectedIndex}
          startStepId={form.startStepId}
          activeStepKey={activeStepKey}
          onSelectStep={handleSelectStepFromList}
          onAddStep={handleAddStepAndEdit}
        />
        <StepDetailPanel
          step={selectedStep}
          onSave={handleSaveStep}
          onDelete={handleDeleteSelectedStep}
          canDelete={canDeleteStep}
          saving={isSaving}
          error={saveError}
        />
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
    </Box>
  );
}
