import PropTypes from "prop-types";
import { AppBar, Toolbar, Typography } from "@mui/material";

export default function NavBar() {
  return (
    <AppBar>
      <Toolbar>
        <Typography
          component="a"
          href="/"
          color="inherit"
          sx={{ textDecoration: "none" }}
        >
          agent-flow
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

NavBar.propTypes = {
  current: PropTypes.string,
};
