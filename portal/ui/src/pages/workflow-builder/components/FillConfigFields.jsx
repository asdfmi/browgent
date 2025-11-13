import PropTypes from "prop-types";
import {
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

export default function FillConfigFields({ config, onChange }) {
  const setConfig = (updates) => onChange({ ...config, ...updates });

  return (
    <>
      <Typography>Fill settings</Typography>
      <TextField
        label="XPath"
        value={config.xpath ?? ""}
        onChange={(event) => setConfig({ xpath: event.target.value })}
      />
      <TextField
        label="Value"
        value={config.value ?? ""}
        onChange={(event) => setConfig({ value: event.target.value || "" })}
        helperText="Enter the text to type. Use {{sourceNodeKey}} placeholders to inject stream outputs."
        required
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(config.clear)}
            onChange={(event) => setConfig({ clear: event.target.checked })}
          />
        }
        label="Clear before typing"
      />
    </>
  );
}

FillConfigFields.propTypes = {
  config: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
