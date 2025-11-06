import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

function StepListItem({ step, index, isSelected, isStart, isActive, onSelect }) {
  const label = step.label?.trim() || step.stepKey || `Step ${index + 1}`;

  return (
    <ListItemButton
      selected={isSelected}
      onClick={onSelect}
      sx={{
        borderRadius: 1.5,
        mb: 1,
        alignItems: "flex-start",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
        <Typography variant="subtitle2" noWrap>
          {label}
        </Typography>
        <Chip
          size="small"
          color="default"
          label={step.type}
          sx={{ textTransform: "uppercase", fontSize: "0.65rem" }}
        />
        {isStart ? (
          <Chip size="small" color="success" label="Start" sx={{ fontSize: "0.65rem" }} />
        ) : null}
        {isActive ? (
          <Chip size="small" color="primary" label="Active" sx={{ fontSize: "0.65rem" }} />
        ) : null}
      </Stack>
      <ListItemText
        primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
        primary={`Key: ${step.stepKey || "-"}`}
        secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
        secondary={step.description || ""}
      />
    </ListItemButton>
  );
}

StepListItem.propTypes = {
  step: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isStart: PropTypes.bool.isRequired,
  isActive: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default function WorkflowStepList({
  steps,
  selectedIndex,
  startStepId,
  activeStepKey,
  onSelectStep,
  onAddStep,
}) {
  return (
    <Box
      sx={{
        width: { xs: "100%", md: 320 },
        flexShrink: 0,
        borderRight: { xs: "none", md: 1 },
        borderColor: { md: "divider" },
        pb: 3,
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          px: 2,
          py: 1.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1">Steps</Typography>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={onAddStep}
            variant="contained"
          >
            New
          </Button>
        </Stack>
      </Box>

      <List sx={{ px: 2, pt: 2, pb: 0 }}>
        {steps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No steps yet. Create your first step to begin.
          </Typography>
        ) : (
          steps.map((step, index) => (
            <StepListItem
              key={step.stepKey || index}
              step={step}
              index={index}
              isSelected={index === selectedIndex}
              isStart={startStepId ? startStepId === step.stepKey : index === 0}
              isActive={activeStepKey ? activeStepKey === step.stepKey : false}
              onSelect={() => onSelectStep(index)}
            />
          ))
        )}
      </List>
      <Divider sx={{ display: { xs: "block", md: "none" }, mt: 2 }} />
    </Box>
  );
}

WorkflowStepList.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedIndex: PropTypes.number.isRequired,
  startStepId: PropTypes.string,
  activeStepKey: PropTypes.string,
  onSelectStep: PropTypes.func.isRequired,
  onAddStep: PropTypes.func.isRequired,
};

WorkflowStepList.defaultProps = {
  startStepId: "",
  activeStepKey: "",
};
