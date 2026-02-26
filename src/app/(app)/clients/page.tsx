"use client";

import * as React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  square_customer_id: string | null;
  created_at?: string;
};

export default function ClientsPage() {
  const [rows, setRows] = React.useState<ClientRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  });

  async function loadClients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .select("id,first_name,last_name,phone,email,notes,square_customer_id,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as ClientRow[]);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadClients();
  }, []);

  async function addClient() {
    if (!form.first_name.trim()) {
      alert("First name is required.");
      return;
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() ? form.last_name.trim() : null,
      phone: form.phone.trim() ? form.phone.trim() : null,
      email: form.email.trim() ? form.email.trim() : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
      // square_customer_id is future integration, leave null for now
    };

    const { error } = await supabase.from("clients").insert(payload);

    if (error) {
      console.error(error);
      alert("Failed to add client. Check console.");
      return;
    }

    setOpen(false);
    setForm({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
    await loadClients();
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">Clients</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Client
        </Button>
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No clients yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    {c.first_name} {c.last_name ?? ""}
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>
                    {c.notes ? (c.notes.length > 60 ? c.notes.slice(0, 60) + "…" : c.notes) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Client</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="First name"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Last name (optional)"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Email (optional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                type="email"
                fullWidth
              />
            </Stack>

            <TextField
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addClient}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}