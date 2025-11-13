import PropTypes from "prop-types";
import { TextField, Typography } from "@mui/material";

export default function ScriptConfigFields({ config, onChange }) {
  const setConfig = (updates) => onChange({ ...config, ...updates });

  return (
    <>
      <Typography>Script settings</Typography>
      <TextField
        label="JavaScript code"
        value={config.code ?? ""}
        onChange={(event) => setConfig({ code: event.target.value })}
        multiline
      />
      <Typography color="text.secondary">
        Provide inputs via streams. The script return value is published on the
        `result` stream.
      </Typography>
    </>
  );
}

ScriptConfigFields.propTypes = {
  config: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
