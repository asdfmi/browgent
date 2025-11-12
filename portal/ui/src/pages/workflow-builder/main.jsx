import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WorkflowBuilderApp from "./App.jsx";
import AppThemeProvider from "../../theme/AppThemeProvider.jsx";

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <AppThemeProvider>
        <WorkflowBuilderApp />
      </AppThemeProvider>
    </StrictMode>,
  );
}
