import PropTypes from "prop-types";
import { Stack, TextField, MenuItem, Typography } from "@mui/material";

export default function LogConfigFields({ config, onChange }) {
  const setConfig = (updates) => onChange({ ...config, ...updates });

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Log settings</Typography>
      <TextField
        label="Target"
        value={config.target ?? "agent-flow"}
        onChange={(event) => setConfig({ target: event.target.value })}
        fullWidth
      />
      <TextField
        select
        label="Level"
        value={config.level ?? "info"}
        onChange={(event) => setConfig({ level: event.target.value })}
        fullWidth
      >
        <MenuItem value="info">info</MenuItem>
        <MenuItem value="warn">warn</MenuItem>
        <MenuItem value="error">error</MenuItem>
      </TextField>
      <TextField
        label="Message"
        value={config.message ?? ""}
        onChange={(event) => setConfig({ message: event.target.value })}
        multiline
        minRows={3}
        fullWidth
      />
    </Stack>
  );
}

LogConfigFields.propTypes = {
  config: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
