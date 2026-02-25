import { Container, Typography, Button, Stack } from "@mui/material";

export default function Home() {
  return (
    <Container sx={{ py: 6 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Salon Cost Tracker</Typography>
        <Typography color="text.secondary">
          Track product usage cost per appointment.
        </Typography>
        <Button variant="contained">It works</Button>
      </Stack>
    </Container>
  );
}