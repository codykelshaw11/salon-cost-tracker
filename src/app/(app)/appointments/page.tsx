"use client";

import * as React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import { useRouter } from "next/navigation";

type ClientOption = {
  id: string;
  first_name: string;
  last_name: string | null;
};

type AppointmentRow = {
  id: string;
  client_id: string;
  appointment_datetime: string; // ISO
  service_name: string | null;
  notes: string | null;
  total_product_cost?: number | null;
  created_at?: string;
  // joined client
  clients?: {
    first_name: string;
    last_name: string | null;
  } | null;
};

function formatDateTime(dtIso: string) {
  // Keep it simple: use browser locale
  const d = new Date(dtIso);
  return d.toLocaleString();
}

export default function AppointmentsPage() {
  const [clients, setClients] = React.useState<ClientOption[]>([]);
  const [rows, setRows] = React.useState<AppointmentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const [form, setForm] = React.useState({
    client_id: "",
    // Use input type datetime-local (no timezone). We'll convert to ISO.
    appointment_local: "",
    service_name: "",
    notes: "",
  });

  async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("id,first_name,last_name")
      .order("first_name", { ascending: true });

    if (error) {
      console.error(error);
      setClients([]);
      return;
    }
    setClients((data ?? []) as ClientOption[]);
  }

  async function loadAppointments() {
    setLoading(true);

    // Join clients for display:
    // This expects FK appointments.client_id -> clients.id
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id,client_id,appointment_datetime,service_name,notes,total_product_cost,created_at,clients(first_name,last_name)"
      )
      .order("appointment_datetime", { ascending: true });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      const normalized =
        (data ?? []).map((a: any) => ({
          ...a,
          total_product_cost:
            a.total_product_cost == null ? null : Number(a.total_product_cost),
        })) as AppointmentRow[];

      setRows(normalized);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    // Load both on mount
    (async () => {
      await loadClients();
      await loadAppointments();
    })();
  }, []);

  async function addAppointment() {
    if (!form.client_id) {
      alert("Please select a client.");
      return;
    }
    if (!form.appointment_local) {
      alert("Please choose a date/time.");
      return;
    }

    // Convert datetime-local to ISO with local timezone applied.
    // datetime-local gives "YYYY-MM-DDTHH:mm"
    const local = new Date(form.appointment_local);
    if (Number.isNaN(local.getTime())) {
      alert("Invalid date/time.");
      return;
    }

    const payload: any = {
      client_id: form.client_id,
      appointment_datetime: local.toISOString(),
      service_name: form.service_name.trim() ? form.service_name.trim() : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
      // total_product_cost defaults to 0/null depending on your schema
    };

    const { error } = await supabase.from("appointments").insert(payload);

    if (error) {
      console.error(error);
      alert("Failed to add appointment. Check console.");
      return;
    }

    setOpen(false);
    setForm({ client_id: "", appointment_local: "", service_name: "", notes: "" });
    await loadAppointments();
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">Appointments</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Appointment
        </Button>
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date/Time</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Product Cost</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Loading…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No appointments yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((a) => {
                const clientName = a.clients
                  ? `${a.clients.first_name} ${a.clients.last_name ?? ""}`.trim()
                  : a.client_id;

                return (
                  <TableRow
                    key={a.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => router.push(`/appointments/${a.id}`)}
                  >
                    <TableCell>
                      {formatDateTime(a.appointment_datetime)}
                    </TableCell>
                    <TableCell>{clientName}</TableCell>
                    <TableCell>{a.service_name ?? "—"}</TableCell>
                    <TableCell>
                      {a.notes
                        ? a.notes.length > 60
                          ? a.notes.slice(0, 60) + "…"
                          : a.notes
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {a.total_product_cost != null
                        ? `$${a.total_product_cost.toFixed(2)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Appointment</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Client"
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              required
            >
              {clients.length === 0 ? (
                <MenuItem value="" disabled>
                  No clients yet — add a client first
                </MenuItem>
              ) : (
                clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name ?? ""}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              label="Date & time"
              type="datetime-local"
              value={form.appointment_local}
              onChange={(e) => setForm((f) => ({ ...f, appointment_local: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />

            <TextField
              label="Service name (optional)"
              value={form.service_name}
              onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
              placeholder="e.g. All-over color, haircut, highlights"
            />

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
          <Button
            variant="contained"
            onClick={addAppointment}
            disabled={clients.length === 0}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}