import PropTypes from "prop-types";
import { TextField, Typography } from "@mui/material";

export default function ExtractTextConfigFields({ config, onChange }) {
  const setConfig = (updates) => onChange({ ...config, ...updates });

  return (
    <>
      <Typography>Extract text settings</Typography>
      <TextField
        label="XPath"
        value={config.xpath ?? ""}
        onChange={(event) => setConfig({ xpath: event.target.value })}
      />
      <Typography color="text.secondary">
        Extracted text is exposed via the node&apos;s stream and can be wired to
        other nodes using streams.
      </Typography>
    </>
  );
}

ExtractTextConfigFields.propTypes = {
  config: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
