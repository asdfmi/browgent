import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  allNodes,
  streams,
  onNodeChange,
  onEdgesChange,
  onStreamsChange,
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

  const createBranchKey = useCallback(() => globalThis.crypto.randomUUID(), []);
  const currentNodeKey = node?.nodeKey ?? "";
  const availableSourceNodes = useMemo(
    () =>
      (allNodes || []).filter(
        (candidate) =>
          candidate?.nodeKey && candidate.nodeKey !== currentNodeKey,
      ),
    [allNodes, currentNodeKey],
  );
  const streamList = useMemo(
    () =>
      (streams || []).map((stream, index) => {
        const streamKey =
          (typeof stream?.streamKey === "string" && stream.streamKey) ||
          (typeof stream?.id === "string" && stream.id) ||
          `stream_${index + 1}`;
        const sourceKey =
          typeof stream?.sourceKey === "string"
            ? stream.sourceKey
            : typeof stream?.fromNodeId === "string"
              ? stream.fromNodeId
              : "";
        return {
          ...stream,
          streamKey,
          sourceKey,
        };
      }),
    [streams],
  );
  const mutateStreams = useCallback(
    (updater) => {
      if (!currentNodeKey || typeof onStreamsChange !== "function") {
        return;
      }
      onStreamsChange((existing = []) => {
        const list = Array.isArray(existing) ? existing : [];
        return updater(list);
      });
    },
    [currentNodeKey, onStreamsChange],
  );
  const handleAddStream = useCallback(() => {
    mutateStreams((list) => [
      ...list,
      {
        streamKey: globalThis.crypto.randomUUID(),
        sourceKey: "",
        targetKey: currentNodeKey,
      },
    ]);
  }, [mutateStreams, currentNodeKey]);
  const handleRemoveStream = useCallback(
    (streamKey) => () => {
      mutateStreams((list) =>
        list.filter((stream) => stream.streamKey !== streamKey),
      );
    },
    [mutateStreams],
  );
  const handleStreamSourceChange = useCallback(
    (streamKey) => (event) => {
      const nextSource = event.target.value;
      mutateStreams((list) =>
        list.map((stream) =>
          stream.streamKey === streamKey
            ? {
                ...stream,
                sourceKey: nextSource,
              }
            : stream,
        ),
      );
    },
    [mutateStreams],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!node || !isIfNode) {
      if (ifBranches.length !== 0) setIfBranches([]);
      if (ifElseTarget !== "") setIfElseTarget("");
      return;
    }
    if (conditionalEdges.length > 0) {
      setIfBranches((prev) => {
        if (
          prev.length === conditionalEdges.length &&
          prev.every(
            (entry, index) => entry.edgeKey === conditionalEdges[index].edgeKey,
          )
        ) {
          return prev;
        }
        return conditionalEdges;
      });
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
  }, [
    node,
    isIfNode,
    conditionalEdges,
    defaultTarget,
    createBranchKey,
    ifBranches.length,
    ifElseTarget,
  ]);
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
    <Stack spacing={2.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2}>
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
          <Stack spacing={1.5}>
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
                <Stack
                  key={branch.edgeKey || index}
                  spacing={1}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid rgba(0,0,0,0.12)",
                    backgroundColor: "rgba(0,0,0,0.02)",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
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
          <Stack spacing={1}>
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

        <Stack spacing={1}>
          <Typography>Configuration</Typography>
          <NodeConfigFields
            type={node.type}
            config={node.config}
            onChange={(nextConfig) => onNodeChange({ config: nextConfig })}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography>Streams</Typography>
          {streamList.length === 0 ? (
            <Typography color="text.secondary">
              No streams yet. Add one to map this node&apos;s variables.
            </Typography>
          ) : (
            streamList.map((stream) => (
              <Stack
                key={stream.streamKey}
                spacing={1}
                sx={{
                  p: 1.5,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <TextField
                  select
                  label="Source node"
                  value={stream.sourceKey ?? ""}
                  onChange={handleStreamSourceChange(stream.streamKey)}
                  helperText={
                    stream.sourceKey
                      ? `Reference via {{${stream.sourceKey}}}`
                      : "Choose which node's result to use"
                  }
                >
                  <MenuItem value="">Select source node</MenuItem>
                  {availableSourceNodes.map((candidate) => (
                    <MenuItem key={candidate.nodeKey} value={candidate.nodeKey}>
                      {candidate.label || candidate.nodeKey}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  onClick={handleRemoveStream(stream.streamKey)}
                  size="small"
                >
                  Remove stream
                </Button>
              </Stack>
            ))
          )}
          <Button onClick={handleAddStream} size="small">
            Add stream
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1}>
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
    inputs: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        required: PropTypes.bool,
      }),
    ),
    outputs: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        required: PropTypes.bool,
      }),
    ),
  }),
  edges: PropTypes.arrayOf(PropTypes.object),
  allEdges: PropTypes.arrayOf(PropTypes.object),
  allNodes: PropTypes.arrayOf(PropTypes.object),
  streams: PropTypes.arrayOf(PropTypes.object),
  onNodeChange: PropTypes.func.isRequired,
  onEdgesChange: PropTypes.func.isRequired,
  onStreamsChange: PropTypes.func,
  onDelete: PropTypes.func.isRequired,
  canDelete: PropTypes.bool,
  saving: PropTypes.bool,
  error: PropTypes.string,
};

NodeDetailPanel.defaultProps = {
  node: null,
  edges: [],
  allEdges: [],
  allNodes: [],
  streams: [],
  onStreamsChange: null,
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
