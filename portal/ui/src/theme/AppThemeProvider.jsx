import PropTypes from "prop-types";
import { useMemo } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export default function AppThemeProvider({ children }) {
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode: "dark" },
      }),
    [],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

AppThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
