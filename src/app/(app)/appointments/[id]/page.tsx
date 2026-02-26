"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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

type Appointment = {
  id: string;
  client_id: string;
  appointment_datetime: string;
  service_name: string | null;
  notes: string | null;
  total_product_cost: number;
  clients?: { first_name: string; last_name: string | null } | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  total_cost: number;
  total_size: number;
  unit: string;
  cost_per_unit: number | null;
};

type UsageRow = {
  id: string;
  appointment_id: string;
  product_id: string;
  amount_used: number;
  unit: string;
  cost_per_unit_at_time: number;
  total_cost: number;
  created_at: string;
  products?: { name: string; brand: string | null } | null;
};

type PreviousAppointment = {
  id: string;
  appointment_datetime: string;
  service_name: string | null;
  notes: string | null;
  total_product_cost: number | null;
};

type PreviousAppointmentWithProducts = PreviousAppointment & {
  product_names: string[];
};

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const appointmentId = params?.id;

  const [appt, setAppt] = React.useState<Appointment | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [usage, setUsage] = React.useState<UsageRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [openAdd, setOpenAdd] = React.useState(false);
  const [addForm, setAddForm] = React.useState({
    product_id: "",
    amount_used: "",
  });

  const [prevLoading, setPrevLoading] = React.useState(false);
  const [prevSummary, setPrevSummary] = React.useState<PreviousAppointmentWithProducts | null>(null);
  const [prevSummaryLoaded, setPrevSummaryLoaded] = React.useState(false);

  const [prevListLoading, setPrevListLoading] = React.useState(false);
  const [prevList, setPrevList] = React.useState<PreviousAppointment[]>([]);
  const [prevListLoaded, setPrevListLoaded] = React.useState(false);

  async function loadAll() {
    if (!appointmentId) return;
    setLoading(true);

    // 1) Appointment (join client for display)
    const { data: apptData, error: apptErr } = await supabase
      .from("appointments")
      .select(
        "id,client_id,appointment_datetime,service_name,notes,total_product_cost,clients(first_name,last_name)"
      )
      .eq("id", appointmentId)
      .single();

    if (apptErr) {
      console.error(apptErr);
      setAppt(null);
      setLoading(false);
      return;
    }

    setAppt({
      ...(apptData as any),
      total_product_cost: Number((apptData as any).total_product_cost ?? 0),
    });

    // 2) Products (for dropdown)
    const { data: prodData, error: prodErr } = await supabase
      .from("products")
      .select("id,name,brand,total_cost,total_size,unit,cost_per_unit")
      .order("created_at", { ascending: false });

    if (prodErr) {
      console.error(prodErr);
      setProducts([]);
    } else {
      const normalized =
        (prodData ?? []).map((p: any) => ({
          ...p,
          total_cost: Number(p.total_cost),
          total_size: Number(p.total_size),
          cost_per_unit: p.cost_per_unit == null ? null : Number(p.cost_per_unit),
        })) as Product[];
      setProducts(normalized);
    }

    // 3) Usage rows (join product name for display)
    const { data: usageData, error: usageErr } = await supabase
      .from("appointment_products")
      .select(
        "id,appointment_id,product_id,amount_used,unit,cost_per_unit_at_time,total_cost,created_at,products(name,brand)"
      )
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false });

    if (usageErr) {
      console.error(usageErr);
      setUsage([]);
    } else {
      const normalized =
        (usageData ?? []).map((u: any) => ({
          ...u,
          amount_used: Number(u.amount_used),
          cost_per_unit_at_time: Number(u.cost_per_unit_at_time),
          total_cost: Number(u.total_cost),
        })) as UsageRow[];
      setUsage(normalized);
    }

    setLoading(false);
  }

  async function loadPreviousSummary() {
  if (!appt?.client_id || !appt?.appointment_datetime) return;

  setPrevLoading(true);
  try {
    // Find the most recent appointment BEFORE the current appointment time
    const { data: prevAppt, error: prevErr } = await supabase
      .from("appointments")
      .select("id,appointment_datetime,service_name,notes,total_product_cost")
      .eq("client_id", appt.client_id)
      .lt("appointment_datetime", appt.appointment_datetime)
      .order("appointment_datetime", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevErr) throw prevErr;

    if (!prevAppt) {
      setPrevSummary(null);
      setPrevSummaryLoaded(true);
      return;
    }

    // Load products used in that previous appointment
    const { data: lines, error: linesErr } = await supabase
      .from("appointment_products")
      .select("products(name)")
      .eq("appointment_id", prevAppt.id);

    if (linesErr) throw linesErr;

    const names =
      (lines ?? [])
        .map((r: any) => r?.products?.name)
        .filter(Boolean) as string[];

    // Unique + sorted for a nice display
    const uniqueNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

    setPrevSummary({
      ...(prevAppt as any),
      total_product_cost: prevAppt.total_product_cost == null ? null : Number(prevAppt.total_product_cost),
      product_names: uniqueNames,
    });

    setPrevSummaryLoaded(true);
  } catch (e) {
    console.error(e);
    alert("Failed to load previous appointment summary. Check console.");
  } finally {
    setPrevLoading(false);
  }
}

React.useEffect(() => {
  // Auto-load previous appointment once the current appointment is available
  if (!appt) return;
  if (prevSummaryLoaded) return; // prevents repeated loads

  loadPreviousSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [appt?.id]);

React.useEffect(() => {
  // When appointmentId changes, reset "previous" section state
  setPrevSummaryLoaded(false);
  setPrevSummary(null);
  // also reset the "all previous" section so it stays on-demand
  setPrevListLoaded(false);
  setPrevList([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [appointmentId]);

async function loadAllPreviousAppointments() {
  if (!appt?.client_id || !appt?.appointment_datetime) return;

  setPrevListLoading(true);
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("id,appointment_datetime,service_name,notes,total_product_cost")
      .eq("client_id", appt.client_id)
      .lt("appointment_datetime", appt.appointment_datetime)
      .order("appointment_datetime", { ascending: false })
      .limit(25);

    if (error) throw error;

    const normalized =
      (data ?? []).map((a: any) => ({
        ...a,
        total_product_cost: a.total_product_cost == null ? null : Number(a.total_product_cost),
      })) as PreviousAppointment[];

    setPrevList(normalized);
    setPrevListLoaded(true);
  } catch (e) {
    console.error(e);
    alert("Failed to load previous appointments. Check console.");
  } finally {
    setPrevListLoading(false);
  }
}

  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function recalcAndPersistTotal() {
    if (!appointmentId) return;

    // Sum from DB (source of truth)
    const { data, error } = await supabase
      .from("appointment_products")
      .select("total_cost")
      .eq("appointment_id", appointmentId);

    if (error) {
      console.error(error);
      return;
    }

    const total = (data ?? []).reduce((sum: number, r: any) => sum + Number(r.total_cost), 0);

    const { error: upErr } = await supabase
      .from("appointments")
      .update({ total_product_cost: total })
      .eq("id", appointmentId);

    if (upErr) console.error(upErr);

    // Update UI state
    setAppt((a) => (a ? { ...a, total_product_cost: total } : a));
  }

  async function addUsageLine() {
    if (!appointmentId) return;

    const productId = addForm.product_id;
    const amountUsed = Number(addForm.amount_used);

    if (!productId) {
      alert("Please select a product.");
      return;
    }
    if (!Number.isFinite(amountUsed) || amountUsed <= 0) {
      alert("Amount used must be a number greater than 0.");
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) {
      alert("Selected product not found.");
      return;
    }

    // Determine cost per unit (prefer stored/generated cost_per_unit)
    const costPerUnit =
      product.cost_per_unit != null
        ? product.cost_per_unit
        : product.total_size > 0
        ? product.total_cost / product.total_size
        : null;

    if (costPerUnit == null || !Number.isFinite(costPerUnit)) {
      alert("Product cost per unit could not be determined.");
      return;
    }

    const totalCost = amountUsed * costPerUnit;

    const payload = {
      appointment_id: appointmentId,
      product_id: productId,
      amount_used: amountUsed,
      unit: product.unit, // keep usage unit aligned to product unit
      cost_per_unit_at_time: costPerUnit,
      total_cost: totalCost,
    };

    const { error } = await supabase.from("appointment_products").insert(payload);

    if (error) {
      console.error(error);
      alert("Failed to add product usage. Check console.");
      return;
    }

    setOpenAdd(false);
    setAddForm({ product_id: "", amount_used: "" });

    await loadAll();
    await recalcAndPersistTotal();
  }

  async function deleteUsageLine(usageId: string) {
    if (!confirm("Delete this product usage line?")) return;

    const { error } = await supabase.from("appointment_products").delete().eq("id", usageId);

    if (error) {
      console.error(error);
      alert("Failed to delete line. Check console.");
      return;
    }

    await loadAll();
    await recalcAndPersistTotal();
  }

  const clientName = appt?.clients
    ? `${appt.clients.first_name} ${appt.clients.last_name ?? ""}`.trim()
    : appt?.client_id ?? "";

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Appointment</Typography>
          {appt ? (
            <Typography color="text.secondary">
              {clientName} • {fmtDateTime(appt.appointment_datetime)}
              {appt.service_name ? ` • ${appt.service_name}` : ""}
            </Typography>
          ) : (
            <Typography color="text.secondary">Loading…</Typography>
          )}
        </Stack>

        <Button variant="contained" onClick={() => setOpenAdd(true)} disabled={loading || !appt}>
          Add Product Used
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Summary</Typography>
          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box>
              <Typography color="text.secondary" variant="body2">
                Client
              </Typography>
              <Typography>{clientName || "—"}</Typography>
            </Box>
            <Box>
              <Typography color="text.secondary" variant="body2">
                Date/Time
              </Typography>
              <Typography>{appt ? fmtDateTime(appt.appointment_datetime) : "—"}</Typography>
            </Box>
            <Box>
              <Typography color="text.secondary" variant="body2">
                Total Product Cost
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {appt ? fmtMoney(appt.total_product_cost ?? 0) : "—"}
              </Typography>
            </Box>
          </Stack>

          {appt?.notes ? (
            <>
              <Divider />
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Notes
                </Typography>
                <Typography>{appt.notes}</Typography>
              </Box>
            </>
          ) : null}
        </Stack>
      </Paper>

    <Paper variant="outlined" sx={{ overflowX: "auto", maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Amount Used</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Cost / Unit</TableCell>
              <TableCell align="right">Line Cost</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading…</TableCell>
              </TableRow>
            ) : usage.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No products logged yet.</TableCell>
              </TableRow>
            ) : (
              usage.map((u) => {
                const productLabel = u.products
                  ? `${u.products.name}${u.products.brand ? ` (${u.products.brand})` : ""}`
                  : u.product_id;

                return (
                  <TableRow key={u.id} hover>
                    <TableCell>{productLabel}</TableCell>
                    <TableCell align="right">{u.amount_used.toFixed(2)}</TableCell>
                    <TableCell>{u.unit}</TableCell>
                    <TableCell align="right">{fmtMoney(u.cost_per_unit_at_time)}</TableCell>
                    <TableCell align="right">{fmtMoney(u.total_cost)}</TableCell>
                    <TableCell align="right">
                      <Button color="error" onClick={() => deleteUsageLine(u.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
  <Stack spacing={2}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="h6">Previous Appointments</Typography>

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={loadPreviousSummary}
          disabled={!appt || prevLoading}
        >
          {prevSummaryLoaded ? "Reload previous" : "Load previous"}
        </Button>

        <Button
          variant="outlined"
          onClick={loadAllPreviousAppointments}
          disabled={!appt || prevListLoading}
        >
          {prevListLoaded ? "Reload all" : "Load all"}
        </Button>
      </Stack>
    </Box>

    {/* Previous appointment summary */}
    <Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        Most Recent Previous Appointment
      </Typography>

      {!prevSummaryLoaded ? (
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Loading previous appointments...
        </Typography>
      ) : prevLoading ? (
        <Typography sx={{ mt: 0.5 }}>Loading…</Typography>
      ) : prevSummary == null ? (
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          No previous appointments found for this client.
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Typography sx={{ fontWeight: 600 }}>
              {fmtDateTime(prevSummary.appointment_datetime)}
            </Typography>
            <Typography color="text.secondary">
              {prevSummary.service_name ?? "—"}
            </Typography>
            <Typography color="text.secondary">
              Total product cost:{" "}
              {prevSummary.total_product_cost != null
                ? fmtMoney(prevSummary.total_product_cost)
                : "—"}
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <Button href={`/appointments/${prevSummary.id}`} component="a">
              Open
            </Button>
          </Stack>

          <Typography
            variant="caption"
            sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Products used last time
          </Typography>

          {prevSummary.product_names.length === 0 ? (
            <Typography color="text.secondary">No products logged on that appointment.</Typography>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {prevSummary.product_names.slice(0, 10).map((name) => (
                <Chip key={name} size="small" color="primary" variant="outlined" label={name} />
              ))}
              {prevSummary.product_names.length > 10 ? (
                <Typography color="text.secondary" sx={{ alignSelf: "center" }}>
                  +{prevSummary.product_names.length - 10} more
                </Typography>
              ) : null}
            </Stack>
          )}

          {prevSummary.notes ? (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
              >
                Notes
              </Typography>
              <Typography>{prevSummary.notes}</Typography>
            </Box>
          ) : null}
        </Stack>
      )}
    </Box>

    <Divider />

    {/* All previous appointments list */}
    <Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        All Previous Appointments
      </Typography>

      {!prevListLoaded ? (
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Click “Load all” to fetch the full history (last 25).
        </Typography>
      ) : prevListLoading ? (
        <Typography sx={{ mt: 0.5 }}>Loading…</Typography>
      ) : prevList.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          No previous appointments found.
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell>Service</TableCell>
                <TableCell align="right">Product Cost</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prevList.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{fmtDateTime(p.appointment_datetime)}</TableCell>
                  <TableCell>{p.service_name ?? "—"}</TableCell>
                  <TableCell align="right">
                    {p.total_product_cost != null ? fmtMoney(p.total_product_cost) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Button href={`/appointments/${p.id}`} component="a" size="small" variant="outlined">
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  </Stack>
</Paper>

      {/* Add usage dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Product Used</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Product"
              value={addForm.product_id}
              onChange={(e) => setAddForm((f) => ({ ...f, product_id: e.target.value }))}
              required
            >
              {products.length === 0 ? (
                <MenuItem value="" disabled>
                  No products yet — add products first
                </MenuItem>
              ) : (
                products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.brand ? ` (${p.brand})` : ""} —{" "}
                    {p.cost_per_unit != null
                      ? `$${p.cost_per_unit.toFixed(4)}/${p.unit}`
                      : `$${(p.total_cost / p.total_size).toFixed(4)}/${p.unit}`}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              label="Amount used"
              value={addForm.amount_used}
              onChange={(e) => setAddForm((f) => ({ ...f, amount_used: e.target.value }))}
              type="number"
              inputProps={{ step: "0.01", min: "0" }}
              required
              helperText="Enter how much of the product was used for this appointment."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={addUsageLine}
            disabled={products.length === 0}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}