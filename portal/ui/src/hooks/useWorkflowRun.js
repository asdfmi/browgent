import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HttpError } from "../api/client.js";
import { getWorkflow, runWorkflow } from "../api/workflows.js";

const MAX_LOG_LENGTH = 100;

export function useWorkflowRun(workflowId) {
  const normalizedId = useMemo(() => {
    if (workflowId == null) return null;
    const parsed = Number(workflowId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [workflowId]);

  const [workflowState, setWorkflowState] = useState({ loading: true, data: null, error: "" });
  const [runState, setRunState] = useState({ status: "idle", runId: null, error: "" });
  const [wsStatus, setWsStatus] = useState("idle");
  const [eventLog, setEventLog] = useState([]);
  const [screenshot, setScreenshot] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(null);
  const wsRef = useRef(null);
  const currentRunIdRef = useRef(null);

  const requestWorkflow = useCallback(async ({ signal } = {}) => {
    if (!normalizedId) {
      setWorkflowState({ loading: false, data: null, error: "Invalid workflow id" });
      return { ok: false, error: "invalid_workflow_id" };
    }
    setWorkflowState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const payload = await getWorkflow(normalizedId, signal ? { signal } : undefined);
      setWorkflowState({ loading: false, data: payload.data, error: "" });
      return { ok: true, data: payload.data };
    } catch (error) {
      if (signal?.aborted) {
        return { ok: false, aborted: true };
      }
      let message = "Unknown error";
      if (error instanceof HttpError) {
        const details = error.data && typeof error.data === "object"
          ? (error.data.error || error.data.message)
          : null;
        message = details || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      if (!signal?.aborted) {
        setWorkflowState({ loading: false, data: null, error: message });
      }
      return { ok: false, error: message };
    }
  }, [normalizedId]);

  useEffect(() => {
    const controller = new AbortController();
    requestWorkflow({ signal: controller.signal });
    return () => controller.abort();
  }, [requestWorkflow]);

  const ensureWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => setWsStatus("open");
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => setWsStatus("closed");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        const currentRunId = currentRunIdRef.current;
        if (!currentRunId || msg.runId !== currentRunId) return;

        if (msg.type === "screenshot" && msg.image) {
          setScreenshot(msg.image);
        } else if (msg.type === "run_status" && msg.status) {
          setRunState((prev) => ({ ...prev, status: String(msg.status) }));
        } else if (msg.type === "done") {
          setRunState((prev) => ({ ...prev, status: "done" }));
          setCurrentStepIndex(null);
        } else if (msg.type === "step_start" || msg.type === "step_end" || msg.type === "log") {
          if (msg.type === "step_start" && typeof msg.index === "number") {
            setCurrentStepIndex(Number(msg.index));
          }
          setEventLog((prev) => {
            const next = [...prev, { ...msg, ts: msg.ts || Date.now() }];
            if (next.length > MAX_LOG_LENGTH) next.shift();
            return next;
          });
        }
      } catch (error) {
        console.warn("Failed to handle WebSocket message", error);
      }
    };

    return ws;
  }, []);

  useEffect(() => () => {
    try {
      wsRef.current?.close();
    } catch (error) {
      console.warn("Failed to close WebSocket", error);
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!normalizedId) return { ok: false };
    setRunState({ status: "starting", runId: null, error: "" });
    setEventLog([]);
    setScreenshot("");
    setCurrentStepIndex(null);

    try {
      const payload = await runWorkflow(normalizedId);
      const runId = String(payload.runId || "");
      if (!runId) throw new Error("runId is missing in response");
      currentRunIdRef.current = runId;
      setRunState({ status: "queued", runId, error: "" });
      const ws = ensureWs();
      if (!ws) return { ok: true };
      const message = JSON.stringify({ type: "subscribe", runId });
      const sendSubscribe = () => {
        try {
          ws.send(message);
        } catch (error) {
          console.warn("Failed to subscribe to run updates", error);
          setRunState({ status: "idle", runId: null, error: "WebSocket connection failed" });
        }
      };
      if (ws.readyState === WebSocket.OPEN) {
        sendSubscribe();
      } else {
        const onOpen = () => {
          sendSubscribe();
          ws.removeEventListener("open", onOpen);
        };
        ws.addEventListener("open", onOpen);
      }
      return { ok: true };
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
      setRunState({ status: "idle", runId: null, error: message });
      return { ok: false, error: message };
    }
  }, [ensureWs, normalizedId]);

  return {
    workflowState,
    runState,
    wsStatus,
    eventLog,
    screenshot,
    currentStepIndex,
    handleRun,
    reloadWorkflow: requestWorkflow,
  };
}
