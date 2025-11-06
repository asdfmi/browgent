import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import NavBar from "../../components/NavBar.jsx";
import { HttpError } from "../../api/client.js";
import {
  createRecord,
  deleteRecord,
  listRecords,
  listTables,
  updateRecord,
} from "../../api/admin.js";

function TableSelector({ tables, active, onSelect }) {
  return (
    <Paper variant="outlined" sx={{ flexShrink: 0 }}>
      <Tabs
        orientation="vertical"
        value={active ?? tables[0]?.name ?? false}
        onChange={(_event, value) => onSelect(value)}
        sx={{ borderRight: 1, borderColor: "divider", minWidth: 200 }}
      >
        {tables.map((table) => (
          <Tab
            key={table.name}
            label={table.label}
            value={table.name}
            sx={{ alignItems: "flex-start" }}
          />
        ))}
      </Tabs>
    </Paper>
  );
}

TableSelector.propTypes = {
  tables: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  active: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

TableSelector.defaultProps = {
  active: null,
};

function RecordCard({ record, primaryKey, onEdit, onDelete, linkBuilder }) {
  const recordId = record?.[primaryKey];
  const title = typeof record.title === "string"
    ? record.title
    : record.slug || record.runKey || record.key || `Record #${recordId}`;

  const link = linkBuilder ? linkBuilder(record) : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
        <Stack spacing={0.25}>
          <Typography variant="subtitle1" noWrap>{title}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {primaryKey}: {String(recordId)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {link ? (
            <Button variant="outlined" size="small" href={link}>
              Open
            </Button>
          ) : null}
          <Tooltip title="Edit">
            <IconButton color="primary" size="small" onClick={() => onEdit(record)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton color="error" size="small" onClick={() => onDelete(record)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <TextField
        multiline
        minRows={6}
        value={JSON.stringify(record, null, 2)}
        variant="outlined"
        InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 13 } }}
      />
    </Paper>
  );
}

RecordCard.propTypes = {
  record: PropTypes.object.isRequired,
  primaryKey: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  linkBuilder: PropTypes.func,
};

RecordCard.defaultProps = {
  linkBuilder: null,
};

function JsonEditorDialog({ open, title, jsonValue, onChange, onClose, onSubmit, submitLabel, submitDisabled, error }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          multiline
          minRows={16}
          value={jsonValue}
          onChange={(event) => onChange(event.target.value)}
          InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

JsonEditorDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  jsonValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string.isRequired,
  submitDisabled: PropTypes.bool,
  error: PropTypes.string,
};

JsonEditorDialog.defaultProps = {
  submitDisabled: false,
  error: "",
};

const initialEditor = { open: false, table: null, id: null, json: "", mode: "view" };

export default function AdminApp() {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(initialEditor);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeMeta = useMemo(() => tables.find((table) => table.name === activeTable) ?? null, [tables, activeTable]);

  const fetchTables = useCallback(async () => {
    try {
      const payload = await listTables();
      const list = Array.isArray(payload.tables) ? payload.tables : [];
      setTables(list);
      if (list.length > 0 && !activeTable) {
        setActiveTable(list[0].name);
      }
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.data && typeof err.data === "object"
          ? (err.data.error || err.data.message)
          : null;
        setError(msg || err.message || "failed_to_fetch_tables");
      } else {
        setError(err instanceof Error ? err.message : "failed_to_fetch_tables");
      }
    }
  }, [activeTable]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const fetchRecords = useCallback(async (tableName) => {
    if (!tableName) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await listRecords(tableName);
      setRecords(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.data && typeof err.data === "object"
          ? (err.data.error || err.data.message)
          : null;
        setError(msg || err.message || "failed_to_fetch_records");
      } else {
        setError(err instanceof Error ? err.message : "failed_to_fetch_records");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(activeTable);
  }, [activeTable, fetchRecords]);

  const handleSelectTable = useCallback((name) => {
    setActiveTable(name);
  }, []);

  const openEditor = useCallback((mode, record = null) => {
    if (!activeMeta) return;
    const json = record ? JSON.stringify(record, null, 2) : JSON.stringify(activeMeta.example ?? {}, null, 2);
    setEditor({ open: true, table: activeMeta.name, id: record ? record[activeMeta.primaryKey] : null, json, mode });
    setEditorError("");
  }, [activeMeta]);

  const closeEditor = () => {
    setEditor(initialEditor);
    setEditorError("");
  };

  const handleDelete = useCallback(async (record) => {
    if (!activeMeta) return;
    const id = record?.[activeMeta.primaryKey];
    if (!window.confirm(`Delete record ${id}?`)) return;
    try {
      await deleteRecord(activeMeta.name, id);
      fetchRecords(activeMeta.name);
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.data && typeof err.data === "object"
          ? (err.data.error || err.data.message)
          : null;
        setError(msg || err.message || "failed_to_delete_record");
      } else {
        setError(err instanceof Error ? err.message : "failed_to_delete_record");
      }
    }
  }, [activeMeta, fetchRecords]);

  const submitEditor = useCallback(async () => {
    if (!editor.table) return;
    let parsed;
    try {
      parsed = JSON.parse(editor.json);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    setSaving(true);
    setEditorError("");
    try {
      if (editor.mode === "edit") {
        await updateRecord(editor.table, editor.id, parsed);
      } else {
        await createRecord(editor.table, parsed);
      }
      closeEditor();
      fetchRecords(editor.table);
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.data && typeof err.data === "object"
          ? (err.data.error || err.data.message)
          : null;
        setEditorError(msg || err.message || "failed_to_save_record");
      } else {
        setEditorError(err instanceof Error ? err.message : "failed_to_save_record");
      }
    } finally {
      setSaving(false);
    }
  }, [editor, fetchRecords]);

  const linkBuilder = useCallback((record) => {
    if (!activeMeta) return null;
    if (activeMeta.name === "workflows") {
      return `/workflow/${record.id}`;
    }
    if (activeMeta.name === "workflowRuns") {
      return `/workflow/${record.workflowId}`;
    }
    return null;
  }, [activeMeta]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <NavBar current="admin" />
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 3, pb: 5 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "flex-start", md: "center" }} sx={{ pt: 3 }}>
          <Stack spacing={0.5}>
            <Typography variant="h4">Admin</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage raw database records for debugging. Changes take effect immediately.
            </Typography>
          </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh tables">
            <IconButton color="primary" onClick={fetchTables}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
            <Tooltip title="Create record">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => openEditor("create")}
                  disabled={!activeMeta}
                >
                  <AddIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Divider />

        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <TableSelector
            tables={tables}
            active={activeTable}
            onSelect={handleSelectTable}
          />
          <Box sx={{ flex: 1 }}>
            {loading ? (
              <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 6 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">
                  Loading records...
                </Typography>
              </Stack>
            ) : records.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No records found for this table.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {records.map((record) => (
                  <RecordCard
                    key={`${activeMeta?.primaryKey || "id"}-${record[activeMeta?.primaryKey || "id"]}`}
                    record={record}
                    primaryKey={activeMeta?.primaryKey || "id"}
                    onEdit={(rec) => openEditor("edit", rec)}
                    onDelete={handleDelete}
                    linkBuilder={linkBuilder}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>

      <JsonEditorDialog
        open={editor.open}
        title={editor.mode === "edit" ? `Edit ${editor.table} record` : `Create ${editor.table} record`}
        jsonValue={editor.json}
        onChange={(value) => setEditor((prev) => ({ ...prev, json: value }))}
        onClose={closeEditor}
        onSubmit={submitEditor}
        submitLabel={editor.mode === "edit" ? "Save changes" : "Create"}
        submitDisabled={saving}
        error={editorError}
      />
    </Box>
  );
}
