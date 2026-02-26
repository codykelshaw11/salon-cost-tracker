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
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const shouldOpen = searchParams.get("new") === "1";
  const [filters, setFilters] = React.useState({
    client_id: "",
    start_date: "", // "YYYY-MM-DD"
    end_date: "",   // "YYYY-MM-DD"
  });

  const [form, setForm] = React.useState({
    client_id: "",
    // Use input type datetime-local (no timezone). We'll convert to ISO.
    appointment_local: "",
    service_name: "",
    notes: "",
  });

  React.useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

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

//   async function loadAppointments() {
//     setLoading(true);

//     // Join clients for display:
//     // This expects FK appointments.client_id -> clients.id
//     const { data, error } = await supabase
//       .from("appointments")
//       .select(
//         "id,client_id,appointment_datetime,service_name,notes,total_product_cost,created_at,clients(first_name,last_name)"
//       )
//       .order("appointment_datetime", { ascending: true });

//     if (error) {
//       console.error(error);
//       setRows([]);
//     } else {
//       const normalized =
//         (data ?? []).map((a: any) => ({
//           ...a,
//           total_product_cost:
//             a.total_product_cost == null ? null : Number(a.total_product_cost),
//         })) as AppointmentRow[];

//       setRows(normalized);
//     }

//     setLoading(false);
//   }

  function startOfDayIsoLocal(dateStr: string) {
    // dateStr: "YYYY-MM-DD"
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toISOString();
  }

  function endOfDayIsoLocal(dateStr: string) {
    // inclusive end of day
    const d = new Date(`${dateStr}T23:59:59.999`);
    return d.toISOString();
  }

async function loadAppointments(activeFilters = filters) {
  setLoading(true);

  let q = supabase
    .from("appointments")
    .select(
      "id,client_id,appointment_datetime,service_name,notes,total_product_cost,created_at,clients(first_name,last_name)"
    );

  // Client filter
  if (activeFilters.client_id) {
    q = q.eq("client_id", activeFilters.client_id);
  }

  // Date range filter (based on appointment_datetime)
  if (activeFilters.start_date) {
    q = q.gte("appointment_datetime", startOfDayIsoLocal(activeFilters.start_date));
  }
  if (activeFilters.end_date) {
    q = q.lte("appointment_datetime", endOfDayIsoLocal(activeFilters.end_date));
  }

  // Sort newest first (or flip to ascending if you want upcoming first)
  const { data, error } = await q.order("appointment_datetime", { ascending: false });

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

    //setOpen(false);
    closeDialog();
    setForm({ client_id: "", appointment_local: "", service_name: "", notes: "" });
    await loadAppointments();
  }

  function closeDialog() {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    router.replace(
      `/clients${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }


  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h4">Appointments</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Appointment
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Filters
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              select
              label="Client"
              value={filters.client_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, client_id: e.target.value }))
              }
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">All clients</MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.first_name} {c.last_name ?? ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Start date"
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, start_date: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />

            <TextField
              label="End date"
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, end_date: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={() => loadAppointments(filters)}
              >
                Apply
              </Button>
              <Button
                onClick={() => {
                  const cleared = {
                    client_id: "",
                    start_date: "",
                    end_date: "",
                  };
                  setFilters(cleared);
                  loadAppointments(cleared);
                }}
              >
                Clear
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

    <Paper variant="outlined" sx={{ overflowX: "hidden", maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
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

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Appointment</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Client"
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
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
              onChange={(e) =>
                setForm((f) => ({ ...f, appointment_local: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              required
            />

            <TextField
              label="Service name (optional)"
              value={form.service_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, service_name: e.target.value }))
              }
              placeholder="e.g. All-over color, haircut, highlights"
            />

            <TextField
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
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