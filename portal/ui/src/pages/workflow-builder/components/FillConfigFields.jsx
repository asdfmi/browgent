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
      <Typography color="text.secondary">
        Value is supplied via streams. Connect an upstream node in the Streams
        panel to feed this input.
      </Typography>
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
