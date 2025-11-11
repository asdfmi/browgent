import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { NODE_TYPES, BRANCH_CONDITION_TYPES } from "../constants.js";
import {
  getDefaultConfig,
  generateEdgeKey,
  createDefaultBranchCondition,
  getBranchConditionType,
  parseNumber,
} from "../utils/workflowBuilder.js";
import NodeConfigFields from "./NodeConfigFields.jsx";

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
  const [ifBranches, setIfBranches] = useState([]);
  const [ifElseTarget, setIfElseTarget] = useState("");

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

  const isIfNode = node?.type === "if";
  const edgeKeys = (allEdges || [])
    .map((edge) => String(edge.edgeKey || "").trim())
    .filter(Boolean);

  const sortedEdges = (edges || []).slice().sort((a, b) => {
    const ap =
      typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const bp =
      typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
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

  /* eslint-disable react-hooks/set-state-in-effect -- state sync between props and local branch editor */
  useEffect(() => {
    if (!node || !isIfNode) {
      setIfBranches([]);
      setIfElseTarget("");
      return;
    }
    if (conditionalEdges.length > 0) {
      setIfBranches(conditionalEdges);
    } else if (conditionalEdges.length === 0 && ifBranches.length === 0) {
      setIfBranches([
        {
          edgeKey: "",
          targetKey: "",
          condition: createDefaultBranchCondition("visible"),
          priority: 0,
        },
      ]);
    }
    setIfElseTarget(defaultTarget ?? "");
  }, [node, isIfNode, conditionalEdges, defaultTarget, ifBranches.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!node) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Select a node from the list to edit its configuration.
        </Typography>
      </Stack>
    );
  }

  const ensureKey = (usedKeys, edgeKey) => {
    let key = String(edgeKey || "").trim();
    if (!key || usedKeys.has(key)) {
      key = generateEdgeKey([...usedKeys]);
    }
    usedKeys.add(key);
    return key;
  };

  const emitDefaultEdge = (targetKey) => {
    const trimmedDefault = String(targetKey || "").trim();
    if (!trimmedDefault) {
      onEdgesChange([]);
      return;
    }
    const usedKeys = new Set(edgeKeys);
    const key = ensureKey(usedKeys, defaultEdge?.edgeKey);
    onEdgesChange([
      {
        edgeKey: key,
        targetKey: trimmedDefault,
        condition: null,
        metadata:
          defaultEdge?.metadata && typeof defaultEdge.metadata === "object"
            ? defaultEdge.metadata
            : null,
        priority: 0,
      },
    ]);
  };

  const emitIfEdgesFromList = (
    branches = ifBranches,
    elseTargetKey = ifElseTarget,
  ) => {
    const usedKeys = new Set(edgeKeys);
    const payload = [];
    (branches || []).forEach((entry, index) => {
      const normalizedTarget = String(entry.targetKey || "").trim();
      if (!normalizedTarget) return;
      const normalizedCondition =
        entry.condition ?? createDefaultBranchCondition("visible");
      payload.push({
        edgeKey: ensureKey(usedKeys, entry.edgeKey),
        targetKey: normalizedTarget,
        condition: normalizedCondition,
        metadata: null,
        priority: index,
      });
    });
    const normalizedElse = String(elseTargetKey || "").trim();
    if (normalizedElse) {
      payload.push({
        edgeKey: ensureKey(usedKeys, defaultEdge?.edgeKey),
        targetKey: normalizedElse,
        condition: null,
        metadata:
          defaultEdge?.metadata && typeof defaultEdge.metadata === "object"
            ? defaultEdge.metadata
            : null,
        priority: payload.length,
      });
    }

    onEdgesChange(payload);
  };

  const handleDefaultTargetChange = (value) => {
    if (isIfNode) {
      setIfElseTarget(value);
      emitIfEdgesFromList(ifBranches, value);
    } else {
      emitDefaultEdge(value);
    }
  };

  const handleIfBranchTargetChange = (index, targetKey) => {
    const next = ifBranches.map((edge, idx) =>
      idx === index ? { ...edge, targetKey } : edge,
    );
    setIfBranches(next);
    emitIfEdgesFromList(next, ifElseTarget);
  };

  const handleIfBranchConditionChange = (index, condition) => {
    const next = ifBranches.map((edge, idx) =>
      idx === index ? { ...edge, condition } : edge,
    );
    setIfBranches(next);
    emitIfEdgesFromList(next, ifElseTarget);
  };

  const handleAddIfBranch = () => {
    const next = [
      ...ifBranches,
      {
        edgeKey: "",
        targetKey: "",
        condition: createDefaultBranchCondition("visible"),
        priority: ifBranches.length,
      },
    ];
    setIfBranches(next);
    emitIfEdgesFromList(next, ifElseTarget);
  };

  const handleRemoveIfBranch = (index) => {
    const next = ifBranches.filter((_, idx) => idx !== index);
    setIfBranches(next);
    emitIfEdgesFromList(next, ifElseTarget);
  };

  const handleIfElseChange = (value) => {
    setIfElseTarget(value);
    emitIfEdgesFromList(ifBranches, value);
  };

  return (
    <Stack spacing={3}>
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
            />
            <TextField
              select
              label="Node type"
              value={node.type}
              onChange={handleTypeChange}
              fullWidth
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
          />
        </Stack>

        {isIfNode ? (
          <Stack spacing={1.5}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Branches</Typography>
              <Typography variant="body2" color="text.secondary">
                Branches are evaluated from top to bottom. The first matching
                condition runs its target node.
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {ifBranches.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No branches yet. Add a branch to configure conditional flows.
                </Typography>
              ) : (
                ifBranches.map((branch, index) => (
                  <Stack key={branch.edgeKey || index} spacing={1.25}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="subtitle2">
                        Branch {index + 1}
                      </Typography>
                      <Button
                        color="error"
                        size="small"
                        onClick={() => handleRemoveIfBranch(index)}
                      >
                        Remove
                      </Button>
                    </Stack>
                    <ConditionEditor
                      value={branch.condition}
                      onChange={(condition) =>
                        handleIfBranchConditionChange(index, condition)
                      }
                    />
                    <TextField
                      label="Target node"
                      value={branch.targetKey ?? ""}
                      onChange={(event) =>
                        handleIfBranchTargetChange(index, event.target.value)
                      }
                      fullWidth
                    />
                  </Stack>
                ))
              )}
            </Stack>
            <Button variant="outlined" size="small" onClick={handleAddIfBranch}>
              Add branch
            </Button>
            <TextField
              label="Else target node"
              value={ifElseTarget}
              onChange={(event) => handleIfElseChange(event.target.value)}
              helperText="Executed when no branch condition is met."
              fullWidth
            />
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Next node</Typography>
            <TextField
              label="Target node key"
              value={defaultTarget}
              onChange={(event) =>
                handleDefaultTargetChange(event.target.value)
              }
              helperText="Leave empty to end the workflow after this node."
              fullWidth
            />
          </Stack>
        )}

        <Stack spacing={1}>
          <Typography variant="subtitle2">Configuration</Typography>
          <NodeConfigFields
            type={node.type}
            config={node.config}
            onChange={(nextConfig) => onNodeChange({ config: nextConfig })}
          />
        </Stack>
      </Stack>

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        alignItems="center"
      >
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
    </Stack>
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

function ConditionEditor({ value, onChange }) {
  const type = getBranchConditionType(value);

  const handleTypeChange = (event) => {
    const nextType = event.target.value;
    onChange(createDefaultBranchCondition(nextType));
  };

  let content = null;
  if (type === "visible" || type === "exists") {
    content = (
      <TextField
        label="XPath"
        value={value?.[type]?.xpath ?? ""}
        onChange={(event) =>
          onChange({
            [type]: { xpath: event.target.value },
          })
        }
        fullWidth
      />
    );
  } else if (type === "urlIncludes") {
    content = (
      <TextField
        label="Substring"
        value={value?.urlIncludes ?? ""}
        onChange={(event) =>
          onChange({
            urlIncludes: event.target.value,
          })
        }
        fullWidth
      />
    );
  } else if (type === "delay") {
    content = (
      <TextField
        label="Delay (seconds)"
        type="number"
        value={value?.delay ?? ""}
        onChange={(event) =>
          onChange({
            delay: parseNumber(event.target.value) ?? 1,
          })
        }
        fullWidth
      />
    );
  } else if (type === "script") {
    content = (
      <TextField
        label="Script"
        value={value?.script?.code ?? ""}
        onChange={(event) =>
          onChange({
            script: { code: event.target.value },
          })
        }
        fullWidth
        multiline
        minRows={3}
      />
    );
  }

  return (
    <Stack spacing={1.25}>
      <TextField
        select
        label="Condition type"
        value={type}
        onChange={handleTypeChange}
        fullWidth
      >
        {BRANCH_CONDITION_TYPES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      {content}
    </Stack>
  );
}

ConditionEditor.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

ConditionEditor.defaultProps = {
  value: null,
};
