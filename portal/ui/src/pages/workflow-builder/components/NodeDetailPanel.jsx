import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { NODE_TYPES } from "../constants.js";
import {
  getDefaultConfig,
  generateEdgeKey,
} from "../utils/workflowBuilder.js";
import NodeConfigFields from "./NodeConfigFields.jsx";
import IfConfigFields from "./IfConfigFields.jsx";

export default function NodeDetailPanel({
  node,
  edges,
  allEdges,
  onNodeChange,
  onEdgesChange,
  onDelete,
  canDelete,
  saving,
  error,
}) {
  if (!node) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Select a node from the list to edit its configuration.
        </Typography>
      </Box>
    );
  }

  const handleFieldChange = (field) => (event) => {
    onNodeChange({ [field]: event.target.value });
  };
  const handleTypeChange = (event) => {
    const nextType = event.target.value;
    const updates = {
      type: nextType,
      config: getDefaultConfig(nextType),
    };
    onNodeChange(updates);
    onEdgesChange([]);
  };

  const edgeKeys = (allEdges || [])
    .map((edge) => String(edge.edgeKey || "").trim())
    .filter(Boolean);

  const sortedEdges = (edges || []).slice().sort((a, b) => {
    const ap = typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const bp = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return 0;
  });

  const defaultEdge = sortedEdges.find((edge) => !edge.condition);
  const defaultTarget = defaultEdge?.targetKey ?? "";
  const conditionalEdges = sortedEdges
    .filter((edge) => edge.condition)
    .map((edge, index) => ({
      edgeKey: edge.edgeKey,
      targetKey: edge.targetKey ?? "",
      condition: edge.condition,
      priority: typeof edge.priority === "number" ? edge.priority : index,
    }));

  const emitEdges = (conditionals, defaultTargetKey) => {
    const usedKeys = new Set(edgeKeys);
    const prepared = [];

    const ensureKey = (edgeKey) => {
      let key = String(edgeKey || "").trim();
      if (!key || usedKeys.has(key)) {
        key = generateEdgeKey([...usedKeys]);
      }
      usedKeys.add(key);
      return key;
    };

    (conditionals || []).forEach((entry, index) => {
      const key = ensureKey(entry.edgeKey);
      const targetKey = String(entry.targetKey || "").trim();
      if (!targetKey) return;
      prepared.push({
        edgeKey: key,
        targetKey,
        condition: entry.condition && typeof entry.condition === "object" ? entry.condition : null,
        metadata: null,
        priority: index,
      });
    });

    const trimmedDefault = String(defaultTargetKey || "").trim();
    if (trimmedDefault) {
      const key = ensureKey(defaultEdge?.edgeKey);
      prepared.push({
        edgeKey: key,
        targetKey: trimmedDefault,
        condition: null,
        metadata: defaultEdge?.metadata && typeof defaultEdge.metadata === "object" ? defaultEdge.metadata : null,
        priority: prepared.length,
      });
    }

    onEdgesChange(prepared);
  };

  const handleDefaultTargetChange = (value) => {
    emitEdges(conditionalEdges, value);
  };

  const handleConditionalChange = (nextEdges) => {
    const sanitized = (nextEdges || []).map((edge, index) => ({
      edgeKey: edge.edgeKey,
      targetKey: String(edge.targetKey || "").trim(),
      condition: edge.condition && typeof edge.condition === "object" ? edge.condition : null,
      priority: typeof edge.priority === "number" ? edge.priority : index,
    }));
    emitEdges(sanitized, defaultTarget);
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 4 },
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Stack spacing={1}>
        <Typography variant="h6">Node details</Typography>
        <Typography variant="body2" color="text.secondary">
          Use the Save button to persist your changes.
        </Typography>
        {saving ? (
          <Typography variant="caption" color="text.secondary">
            Saving…
          </Typography>
        ) : null}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2} divider={<Divider flexItem />}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <TextField
              label="Node key"
              value={node.nodeKey ?? ""}
              onChange={handleFieldChange("nodeKey")}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Node type"
              value={node.type}
              onChange={handleTypeChange}
              fullWidth
              size="small"
            >
              {NODE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Label"
            value={node.label ?? ""}
            onChange={handleFieldChange("label")}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Default next node
            </Typography>
            <TextField
              label="Target node key"
              value={defaultTarget}
              onChange={(event) => handleDefaultTargetChange(event.target.value)}
              helperText="Used when no conditional edge matches."
              fullWidth
              size="small"
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Conditional edges
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Edges are evaluated from top to bottom; the first matching condition determines the next node.
            </Typography>
            <IfConfigFields
              edges={conditionalEdges}
              onChange={handleConditionalChange}
            />
          </Box>
        </Stack>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Configuration
          </Typography>
          <NodeConfigFields
            type={node.type}
            config={node.config}
            onChange={(nextConfig) => onNodeChange({ config: nextConfig })}
          />
        </Box>

      </Stack>

      <Stack direction="row" justifyContent="flex-end" spacing={1} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Delete this node
        </Typography>
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={onDelete}
          disabled={!canDelete || saving}
        >
          Delete
        </Button>
      </Stack>
    </Box>
  );
}

NodeDetailPanel.propTypes = {
  node: PropTypes.shape({
    nodeKey: PropTypes.string,
    label: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string.isRequired,
    config: PropTypes.object,
  }),
  edges: PropTypes.arrayOf(PropTypes.object),
  allEdges: PropTypes.arrayOf(PropTypes.object),
  onNodeChange: PropTypes.func.isRequired,
  onEdgesChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canDelete: PropTypes.bool,
  saving: PropTypes.bool,
  error: PropTypes.string,
};

NodeDetailPanel.defaultProps = {
  node: null,
  edges: [],
  allEdges: [],
  canDelete: true,
  saving: false,
  error: "",
};
