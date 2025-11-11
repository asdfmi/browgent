import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { NODE_TYPES, BRANCH_CONDITION_TYPES } from "../constants.js";
import {
  getDefaultConfig,
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
  const skipSyncRef = useRef(false);

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
  const createBranchKey = () => globalThis.crypto.randomUUID();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
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
          edgeKey: createBranchKey(),
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
      <Stack>
        <Typography>
          Select a node from the list to edit its configuration.
        </Typography>
      </Stack>
    );
  }

  const ensureKey = (usedKeys, edgeKey) => {
    let key = String(edgeKey || "").trim();
    if (!key || usedKeys.has(key)) {
      do {
        key = globalThis.crypto.randomUUID();
      } while (usedKeys.has(key));
    }
    usedKeys.add(key);
    return key;
  };

  const emitDefaultEdge = (targetKey) => {
    const trimmedDefault = String(targetKey || "").trim();
    if (!trimmedDefault) {
      skipSyncRef.current = true;
      onEdgesChange([]);
      return;
    }
    const usedKeys = new Set(edgeKeys);
    const key = ensureKey(usedKeys, defaultEdge?.edgeKey);
    skipSyncRef.current = true;
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

    skipSyncRef.current = true;
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
        edgeKey: createBranchKey(),
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
    <Stack>
      <Stack>
        <Typography>Node details</Typography>
        <Typography>Use the Save button to persist your changes.</Typography>
        {saving ? <Typography>Saving…</Typography> : null}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack>
        <TextField label="Node key" value={node.nodeKey ?? ""} disabled />
        <TextField
          select
          label="Node type"
          value={node.type}
          onChange={handleTypeChange}
        >
          {NODE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Label"
          value={node.label ?? ""}
          onChange={handleFieldChange("label")}
        />

        {isIfNode ? (
          <Stack>
            <Typography>Branches</Typography>
            <Typography>
              Branches are evaluated from top to bottom. The first matching
              condition runs its target node.
            </Typography>
            {ifBranches.length === 0 ? (
              <Typography>
                No branches yet. Add a branch to configure conditional flows.
              </Typography>
            ) : (
              ifBranches.map((branch, index) => (
                <Stack key={branch.edgeKey || index}>
                  <Stack>
                    <Typography>Branch {index + 1}</Typography>
                    <Button onClick={() => handleRemoveIfBranch(index)}>
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
                  />
                </Stack>
              ))
            )}
            <Button onClick={handleAddIfBranch}>Add branch</Button>
            <TextField
              label="Else target node"
              value={ifElseTarget}
              onChange={(event) => handleIfElseChange(event.target.value)}
            />
          </Stack>
        ) : (
          <Stack>
            <Typography>Next node</Typography>
            <TextField
              label="Target node key"
              value={defaultTarget}
              onChange={(event) =>
                handleDefaultTargetChange(event.target.value)
              }
            />
          </Stack>
        )}

        <Stack>
          <Typography>Configuration</Typography>
          <NodeConfigFields
            type={node.type}
            config={node.config}
            onChange={(nextConfig) => onNodeChange({ config: nextConfig })}
          />
        </Stack>
      </Stack>

      <Stack>
        <Button onClick={onDelete} disabled={!canDelete || saving}>
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
        multiline
      />
    );
  }

  return (
    <Stack>
      <TextField
        select
        label="Condition type"
        value={type}
        onChange={handleTypeChange}
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
