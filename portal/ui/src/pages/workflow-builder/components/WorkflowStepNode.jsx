import PropTypes from "prop-types";
import { alpha } from "@mui/material/styles";
import { Box, Chip, Stack, Typography } from "@mui/material";

export default function WorkflowStepNode({
  step,
  index,
  isStart,
  isSelected,
  isActive,
  onSelect,
}) {
  const label = step.label?.trim() || step.stepKey || `Step ${index + 1}`;
  const description = step.description || "";
  const next = step.nextStepKey || "";
  const exit = step.exitStepKey || "";

  const borderColor = isActive
    ? "secondary.main"
    : isSelected
      ? "primary.main"
      : "divider";

  const backgroundColor = (theme) => {
    if (isActive) return alpha(theme.palette.secondary.light, 0.18);
    if (isSelected) return alpha(theme.palette.primary.light, 0.16);
    return theme.palette.background.paper;
  };

  const handleClick = () => {
    onSelect?.();
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: 2,
        borderColor,
        bgcolor: backgroundColor,
        boxShadow: isSelected ? 4 : 1,
        px: 2,
        py: 1.5,
        minWidth: 200,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "box-shadow 120ms ease, transform 120ms ease",
        "&:hover": {
          boxShadow: 6,
          transform: "translateY(-2px)",
        },
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" noWrap>
            {label}
          </Typography>
          <Chip
            size="small"
            label={step.type}
            color="default"
            sx={{ textTransform: "uppercase", fontSize: "0.7rem" }}
          />
        </Stack>
        {isStart ? (
          <Chip
            size="small"
            color="success"
            label="Start"
            sx={{ alignSelf: "flex-start", fontSize: "0.7rem" }}
          />
        ) : null}
        {description ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {description}
          </Typography>
        ) : null}
        <Typography variant="caption" color="text.secondary" noWrap>
          Key: {step.stepKey || "-"}
        </Typography>
        {next ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            Next: {next}
          </Typography>
        ) : null}
        {exit ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            Exit: {exit}
          </Typography>
        ) : null}
        <Typography variant="caption" color="text.disabled">
          Step #{index + 1}
        </Typography>
      </Stack>
    </Box>
  );
}

WorkflowStepNode.propTypes = {
  step: PropTypes.shape({
    stepKey: PropTypes.string,
    label: PropTypes.string,
    type: PropTypes.string.isRequired,
    description: PropTypes.string,
    nextStepKey: PropTypes.string,
    exitStepKey: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isStart: PropTypes.bool,
  isSelected: PropTypes.bool,
  isActive: PropTypes.bool,
  onSelect: PropTypes.func,
};

WorkflowStepNode.defaultProps = {
  isStart: false,
  isSelected: false,
  isActive: false,
  onSelect: null,
};
