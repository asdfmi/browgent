import { useEffect, useState } from "react";
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { listWorkflows } from "../../../api/workflows.js";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);

  useEffect(() => {
    listWorkflows()
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setWorkflows(rows);
      })
      .catch(() => {
        setWorkflows([]);
      });
  }, []);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Workflows</Typography>
        <Button
          variant="contained"
          color="primary"
          component="a"
          href="/workflow/new"
        >
          Create workflow
        </Button>
      </Stack>
      {workflows.length === 0 ? (
        <Typography>No workflows available.</Typography>
      ) : (
        <List>
          {workflows.map((workflow) => {
            const target = `/workflow/${encodeURIComponent(String(workflow.id))}`;
            return (
              <ListItem key={workflow.id}>
                <ListItemButton component="a" href={target}>
                  <ListItemText
                    primary={`Title: ${workflow.title}`}
                    secondary={`Description: ${workflow.description || "-"}`}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
