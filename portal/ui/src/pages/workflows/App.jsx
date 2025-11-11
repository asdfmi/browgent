import { Box, Toolbar } from "@mui/material";
import NavBar from "../../components/NavBar.jsx";
import WorkflowsPage from "./components/WorkflowsPage.jsx";

export default function WorkflowsApp() {
  return (
    <>
      <NavBar />
      <Toolbar />
      <Box
        component="main"
        sx={{ width: "100%", maxWidth: 640, mx: "auto", px: 2, py: 4 }}
      >
        <WorkflowsPage />
      </Box>
    </>
  );
}
