import { Box, Toolbar } from "@mui/material";
import NavBar from "../../components/NavBar.jsx";
import WorkflowBuilderPage from "./components/WorkflowBuilderPage.jsx";

export default function WorkflowBuilderApp() {
  return (
    <>
      <NavBar />
      <Toolbar />
      <Box component="main">
        <WorkflowBuilderPage />
      </Box>
    </>
  );
}
