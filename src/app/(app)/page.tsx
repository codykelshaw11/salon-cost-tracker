"use client";

import * as React from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import { supabase } from "@/lib/supabase/client";

type UpcomingAppointment = {
  appointment_id: string;
  appointment_datetime: string;
  service_name: string | null;
  first_name: string;
  last_name: string | null;
  //clients?: { first_name: string; last_name: string | null } | null;
  prev_product_names: string[]; // comes from the view
};

function fmtDateTimeShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [upcoming, setUpcoming] = React.useState<UpcomingAppointment[]>([]);

  async function loadUpcoming() {
    setLoading(true);

    const now = new Date().toISOString();
    // Next 7 days
    const end = new Date();
    end.setDate(end.getDate() + 7);

    const { data, error } = await supabase
      .from("dashboard_upcoming_appointments")
      .select(
        "appointment_id,appointment_datetime,service_name,client_id,first_name,last_name,prev_product_names",
      )
      .gte("appointment_datetime", now)
      .lte("appointment_datetime", end.toISOString())
      .order("appointment_datetime", { ascending: true })
      .limit(20);

    if (error) {
      console.error(error);
      setUpcoming([]);
    } else {
      const normalized = (data ?? []).map((a: any) => ({
        ...a,
        total_product_cost:
          a.total_product_cost == null ? null : Number(a.total_product_cost),
      })) as UpcomingAppointment[];
      setUpcoming(normalized);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadUpcoming();
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Dashboard</Typography>

      {/* Quick Actions */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardHeader title="Quick Actions" />
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {/* These just link to your existing pages for now */}
              <Button
                variant="contained"
                component={Link}
                href="/clients?new=1"
              >
                Add Client
              </Button>
              <Button
                variant="contained"
                component={Link}
                href="/appointments?new=1"
              >
                New Appointment
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/products?new=1"
              >
                Add Product
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Tip: Once Square integration is added, “Today’s Appointments” will
              auto-populate.
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Today’s Appointments (Square placeholder) */}
      <Card variant="outlined">
        <CardHeader
          title="Today’s Appointments"
          subheader="(Square integration placeholder)"
        />
        <CardContent>
          <Typography color="text.secondary">
            This section will show today’s bookings pulled from Square,
            including client info and service.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Chip label="Coming soon" />
          </Box>
        </CardContent>
      </Card>

      {/* Upcoming (DB-backed, useful now) */}
      <Card variant="outlined">
        <CardHeader
          title="Upcoming (Next 7 Days)"
          subheader="Pulled from appointments you've created in the app"
          action={
            <Button component={Link} href="/appointments">
              View all
            </Button>
          }
        />
        <Divider />
        <CardContent>
          {loading ? (
            <Typography>Loading…</Typography>
          ) : upcoming.length === 0 ? (
            <Typography color="text.secondary">
              No upcoming appointments in the next 7 days.
            </Typography>
          ) : (
            <List disablePadding>
              {upcoming.map((a) => {
                const clientName = a.first_name
                  ? `${a.first_name} ${a.last_name ?? ""}`.trim()
                  : "Unknown client";

                return (
                  <ListItem
                    key={a.appointment_id}
                    component={Link}
                    href={`/appointments/${a.appointment_id}`}
                    sx={{
                      borderRadius: 1,
                      "&:hover": { bgcolor: "action.hover" },
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          alignItems={{ sm: "center" }}
                        >
                          <Typography sx={{ fontWeight: 600 }}>
                            {clientName}
                          </Typography>
                          <Typography color="text.secondary">
                            {fmtDateTimeShort(a.appointment_datetime)}
                          </Typography>
                          {a.service_name ? (
                            <Chip size="small" label={a.service_name} />
                          ) : null}
                        </Stack>
                      }
                      secondary={
                        <Typography component="div" variant="body2" color="text.secondary">
                            <Stack spacing={0.5}>
                        <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
                        >
                            PRODUCTS USED PREVIOUSLY
                        </Typography>

                        {(a.prev_product_names ?? []).length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                            No previous products logged
                            </Typography>
                        ) : (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                            {(a.prev_product_names ?? []).slice(0, 4).map((name) => (
                                <Chip key={name} size="small" color="primary" variant="outlined" label={name} />
                            ))}
                            {(a.prev_product_names ?? []).length > 4 ? (
                                <Chip
                                size="small"
                                label={`+${a.prev_product_names.length - 4} more`}
                                />
                            ) : null}
                            </Stack>
                        )}
                        </Stack>
                    </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}