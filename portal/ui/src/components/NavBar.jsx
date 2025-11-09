import PropTypes from "prop-types";
import { AppBar, Toolbar, Typography, Button, Stack } from "@mui/material";

const links = [{ key: "workflows", label: "Workflows", href: "/" }];

export default function NavBar({ current } = {}) {
  return (
    <AppBar position="static" color="default" elevation={1} sx={{ mb: 2 }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          agent-flow
        </Typography>
        <Stack direction="row" spacing={1}>
          {links.map((link) => (
            <Button
              key={link.key}
              component="a"
              href={link.href}
              color="primary"
              variant={current === link.key ? "contained" : "text"}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

NavBar.propTypes = {
  current: PropTypes.string,
};
