import { Box, Toolbar, useMediaQuery, useTheme } from "@mui/material";
import NavBar from "../../components/NavBar.jsx";
import WorkflowBuilderPage from "./components/WorkflowBuilderPage.jsx";

export default function WorkflowBuilderApp() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));
  const navHeight = isDesktop ? 64 : 56;

  return (
    <>
      <NavBar />
      <Toolbar />
      <Box
        component="main"
        sx={{
          height: `calc(100dvh - ${navHeight}px)`,
          overflow: "hidden",
        }}
      >
        <WorkflowBuilderPage />
      </Box>
    </>
  );
}
