import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  Divider,
  Button,
} from "@mui/material";
import { HttpError } from "../../../api/client.js";
import {
  createDraftWorkflow,
  listWorkflows,
} from "../../../api/workflows.js";

const initialState = { loading: true, data: [], error: "" };

export default function WorkflowsPage() {
  const [state, setState] = useState(initialState);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState(initialState);
      try {
        const payload = await listWorkflows({ signal: controller.signal });
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setState({ loading: false, data: rows, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        let message = "Unknown error";
        if (error instanceof HttpError) {
          const details = error.data && typeof error.data === "object"
            ? (error.data.error || error.data.message)
            : null;
          message = details || error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        setState({ loading: false, data: [], error: message });
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError("");
    try {
      const payload = await createDraftWorkflow();
      const id = payload?.data?.id;
      if (id) {
        window.location.href = `/workflow/${id}`;
        return;
      }
      throw new Error("draft workflow id missing");
    } catch (error) {
      let message = "Unknown error";
      if (error instanceof HttpError) {
        const details = error.data && typeof error.data === "object"
          ? (error.data.error || error.data.message)
          : null;
        message = details || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, []);

  if (state.loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5">Workflows</Typography>
              <Typography variant="body2" color="text.secondary">
                Select a workflow to view details and run the automation.
              </Typography>
            </Stack>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={creating}
              sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
            >
              {creating ? "Creating..." : "Create workflow"}
            </Button>
          </Stack>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {createError ? <Alert severity="error">{createError}</Alert> : null}
          <Divider />
          {state.data.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No workflows have been registered yet.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {state.data.map((workflow) => (
                <Paper
                  key={workflow.id}
                  variant="outlined"
                  sx={{ p: 2, cursor: "pointer", "&:hover": { boxShadow: 4 } }}
                  onClick={() => {
                    window.location.href = `/workflow/${workflow.id}`;
                  }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{workflow.title || workflow.slug}</Typography>
                    {workflow.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {workflow.description}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Updated: {workflow.updatedAt}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.location.href = `/workflow/${workflow.id}`;
                        }}
                      >
                        View details
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
