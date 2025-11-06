import PropTypes from "prop-types";
import { useEffect, useState } from "react";
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
import { STEP_TYPES, SUCCESS_TYPES } from "../constants.js";
import {
  createDefaultSuccessConfig,
  getDefaultConfig,
  getSuccessType,
  parseNumber,
  cleanSuccessConfig,
} from "../utils/workflowBuilder.js";
import StepConfigFields from "./StepConfigFields.jsx";

function cloneStep(value) {
  if (!value) return null;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function SuccessConfigEditor({ value, onChange }) {
  const type = getSuccessType(value);

  const handleTypeChange = (event) => {
    const nextType = event.target.value;
    if (!nextType) {
      onChange(null);
      return;
    }
    onChange(createDefaultSuccessConfig(nextType));
  };

  const updateSuccess = (updater) => {
    const baseType = type || "delay";
    const current = value || createDefaultSuccessConfig(baseType);
    const next = updater(current);
    onChange(cleanSuccessConfig(next));
  };

  return (
    <Stack spacing={1.5}>
      <TextField
        select
        label="Success condition"
        value={type}
        onChange={handleTypeChange}
        size="small"
        helperText="Workflow step waits for this condition before continuing."
      >
        {SUCCESS_TYPES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      {type ? (
        <Stack spacing={1.5}>
          {type === "delay" ? (
            <>
              <TextField
                label="Delay (seconds)"
                type="number"
                value={value?.condition?.delay ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    condition: {
                      ...prev.condition,
                      delay: parseNumber(event.target.value) ?? 1,
                    },
                  }))
                }
                size="small"
              />
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={value?.timeout ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    timeout: parseNumber(event.target.value) ?? 5,
                  }))
                }
                size="small"
              />
            </>
          ) : null}
          {type === "visible" || type === "exists" ? (
            <>
              <TextField
                label="XPath"
                value={
                  value?.condition?.visible?.xpath ??
                  value?.condition?.exists?.xpath ??
                  ""
                }
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    condition: {
                      ...(type === "visible"
                        ? { visible: { xpath: event.target.value } }
                        : { exists: { xpath: event.target.value } }),
                    },
                  }))
                }
                size="small"
              />
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={value?.timeout ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    timeout: parseNumber(event.target.value) ?? 5,
                  }))
                }
                size="small"
              />
            </>
          ) : null}
          {type === "urlIncludes" ? (
            <>
              <TextField
                label="URL must include"
                value={value?.condition?.urlIncludes ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    condition: { urlIncludes: event.target.value },
                  }))
                }
                size="small"
              />
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={value?.timeout ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    timeout: parseNumber(event.target.value) ?? 5,
                  }))
                }
                size="small"
              />
            </>
          ) : null}
          {type === "script" ? (
            <>
              <TextField
                label="Script"
                value={value?.condition?.script?.code ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    condition: {
                      script: { code: event.target.value },
                    },
                  }))
                }
                size="small"
                multiline
                minRows={4}
              />
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={value?.timeout ?? ""}
                onChange={(event) =>
                  updateSuccess((prev) => ({
                    ...prev,
                    timeout: parseNumber(event.target.value) ?? 5,
                  }))
                }
                size="small"
              />
            </>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

SuccessConfigEditor.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

SuccessConfigEditor.defaultProps = {
  value: null,
};

export default function StepDetailPanel({
  step,
  onSave,
  onDelete,
  canDelete,
  saving,
  error,
}) {
  const [draft, setDraft] = useState(cloneStep(step));

  useEffect(() => {
    setDraft(cloneStep(step));
  }, [step]);

  const handleChange = (updates) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleTypeChange = (event) => {
    const nextType = event.target.value;
    handleChange({
      type: nextType,
      config: getDefaultConfig(nextType),
      successConfig: null,
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    await onSave(draft);
  };

  if (!draft) {
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
          Select a step from the list to edit its configuration.
        </Typography>
      </Box>
    );
  }

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
        <Typography variant="h6">Step details</Typography>
        <Typography variant="body2" color="text.secondary">
          Update the configuration and save to persist changes.
        </Typography>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2} divider={<Divider flexItem />}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <TextField
              label="Step key"
              value={draft.stepKey}
              onChange={(event) => handleChange({ stepKey: event.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Step type"
              value={draft.type}
              onChange={handleTypeChange}
              fullWidth
              size="small"
            >
              {STEP_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Label"
            value={draft.label}
            onChange={(event) => handleChange({ label: event.target.value })}
            fullWidth
            size="small"
          />
          <TextField
            label="Description"
            value={draft.description ?? ""}
            onChange={(event) => handleChange({ description: event.target.value })}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <TextField
            label="Next step key"
            value={draft.nextStepKey}
            onChange={(event) => handleChange({ nextStepKey: event.target.value })}
            fullWidth
            size="small"
          />
          <TextField
            label="Exit step key"
            value={draft.exitStepKey}
            onChange={(event) => handleChange({ exitStepKey: event.target.value })}
            helperText="Used by loop steps."
            fullWidth
            size="small"
          />
        </Stack>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Configuration
          </Typography>
          <StepConfigFields
            type={draft.type}
            config={draft.config}
            onChange={(nextConfig) => handleChange({ config: nextConfig })}
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Success condition
          </Typography>
          <SuccessConfigEditor
            value={draft.successConfig}
            onChange={(next) => handleChange({ successConfig: next })}
          />
        </Box>
      </Stack>

      <Stack direction="row" justifyContent="space-between">
        <Button
          variant="outlined"
          color="error"
          onClick={onDelete}
          disabled={!canDelete || saving}
        >
          Delete step
        </Button>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" color="inherit" onClick={() => setDraft(cloneStep(step))} disabled={saving}>
            Reset
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

StepDetailPanel.propTypes = {
  step: PropTypes.shape({
    stepKey: PropTypes.string,
    label: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string,
    nextStepKey: PropTypes.string,
    exitStepKey: PropTypes.string,
    config: PropTypes.object,
    successConfig: PropTypes.object,
  }),
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canDelete: PropTypes.bool,
  saving: PropTypes.bool,
  error: PropTypes.string,
};

StepDetailPanel.defaultProps = {
  step: null,
  canDelete: true,
  saving: false,
  error: "",
};
