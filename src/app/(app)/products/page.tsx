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
  TableContainer,
} from "@mui/material";
import { supabase } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  total_cost: number;
  total_size: number;
  unit: string;
  cost_per_unit?: number | null;
  category_id: string | null;
  product_categories?: { name: string } | null; // join
};

const UNITS = ["oz", "ml", "g"] as const;

export default function ProductsPage() {
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    brand: "",
    total_cost: "",
    total_size: "",
    unit: "oz",
    category_id: "",
  });

  async function loadCategories() {
    const { data, error } = await supabase
      .from("product_categories")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setCategories([]);
      return;
    }

    setCategories((data ?? []) as Category[]);
  }

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,brand,total_cost,total_size,unit,cost_per_unit,category_id,product_categories(name)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      // Normalize numeric columns
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
    (async () => {
      await loadCategories();
      await loadProducts();
    })();
  }, []);

  function closeDialog() {
    setOpen(false);
    setForm({
      name: "",
      brand: "",
      total_cost: "",
      total_size: "",
      unit: "oz",
      category_id: "",
    });
  }

  async function addProduct() {
    const total_cost = Number(form.total_cost);
    const total_size = Number(form.total_size);

    if (!form.name.trim()) {
      alert("Product name is required.");
      return;
    }
    if (!Number.isFinite(total_cost) || total_cost < 0) {
      alert("Bottle cost must be a valid number.");
      return;
    }
    if (!Number.isFinite(total_size) || total_size <= 0) {
      alert("Bottle size must be a valid number greater than 0.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() ? form.brand.trim() : null,
      total_cost,
      total_size,
      unit: form.unit,
      category_id: form.category_id ? form.category_id : null,
    };

    const { error } = await supabase.from("products").insert(payload);

    if (error) {
      console.error(error);
      alert("Failed to add product. Check console.");
      return;
    }

    closeDialog();
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

      {/* Responsive table container */}
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Bottle Cost</TableCell>
              <TableCell align="right">Bottle Size</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Cost / Unit</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>Loading…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No products yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.brand ?? "—"}</TableCell>
                  <TableCell>{r.product_categories?.name ?? "—"}</TableCell>
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
      </TableContainer>

      {/* Add dialog */}
      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Brand (optional)"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                fullWidth
              />

              <TextField
                select
                label="Category (optional)"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                fullWidth
              >
                <MenuItem value="">None</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

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
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={addProduct}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}