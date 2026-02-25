"use client";

import * as React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { supabase } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  total_cost: number;
  total_size: number;
  unit: string;
  cost_per_unit?: number | null;
};

const UNITS = ["oz", "ml", "g"] as const;

export default function ProductsPage() {
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    brand: "",
    total_cost: "",
    total_size: "",
    unit: "oz",
  });

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,brand,total_cost,total_size,unit,cost_per_unit")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      // Supabase returns numerics as strings sometimes depending on config; normalize.
      const normalized =
        (data ?? []).map((p: any) => ({
          ...p,
          total_cost: Number(p.total_cost),
          total_size: Number(p.total_size),
          cost_per_unit: p.cost_per_unit == null ? null : Number(p.cost_per_unit),
        })) as ProductRow[];
      setRows(normalized);
    }
    setLoading(false);
  }

  React.useEffect(() => {
    loadProducts();
  }, []);

  async function addProduct() {
    const total_cost = Number(form.total_cost);
    const total_size = Number(form.total_size);

    if (!form.name.trim() || !Number.isFinite(total_cost) || !Number.isFinite(total_size) || total_size <= 0) {
      alert("Please enter name, total cost, and total size (size must be > 0).");
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() ? form.brand.trim() : null,
      total_cost,
      total_size,
      unit: form.unit,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) {
      console.error(error);
      alert("Failed to add product. Check console.");
      return;
    }

    setOpen(false);
    setForm({ name: "", brand: "", total_cost: "", total_size: "", unit: "oz" });
    await loadProducts();
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h4">Products</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Product
        </Button>
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell align="right">Bottle Cost</TableCell>
              <TableCell align="right">Bottle Size</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Cost / Unit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No products yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.brand ?? "—"}</TableCell>
                  <TableCell align="right">${r.total_cost.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.total_size.toFixed(2)}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell align="right">
                    {r.cost_per_unit != null ? `$${Number(r.cost_per_unit).toFixed(4)}` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <TextField
              label="Brand (optional)"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Bottle cost"
                value={form.total_cost}
                onChange={(e) => setForm((f) => ({ ...f, total_cost: e.target.value }))}
                type="number"
                inputProps={{ step: "0.01", min: "0" }}
                required
                fullWidth
              />
              <TextField
                label="Bottle size"
                value={form.total_size}
                onChange={(e) => setForm((f) => ({ ...f, total_size: e.target.value }))}
                type="number"
                inputProps={{ step: "0.01", min: "0" }}
                required
                fullWidth
              />
              <TextField
                select
                label="Unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                fullWidth
              >
                {UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addProduct}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}