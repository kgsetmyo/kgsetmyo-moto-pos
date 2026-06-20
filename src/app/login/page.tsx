"use client";

import { useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Full navigation so middleware picks up auth cookies immediately (faster than push+refresh)
    window.location.assign("/dashboard");
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.level1",
        p: 2,
      }}
    >
      <Sheet variant="outlined" sx={{ p: 4, width: 400, borderRadius: "lg" }}>
        <Stack spacing={2} component="form" onSubmit={handleLogin}>
          <Typography level="h3">Moto POS</Typography>
          <Typography level="body-sm" textColor="neutral.500">
            Motorcycle spare parts — sign in to continue
          </Typography>

          <FormControl>
            <FormLabel>Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormControl>

          <FormControl>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormControl>

          {process.env.NODE_ENV === "development" && (
            <Typography level="body-xs" textColor="neutral.500" sx={{ bgcolor: "background.level2", p: 1, borderRadius: "sm" }}>
              Dev login: admin@moto-parts.shop / admin123456
            </Typography>
          )}

          {error && (
            <Typography level="body-sm" color="danger">
              {error}
            </Typography>
          )}

          <Button type="submit" loading={loading} fullWidth>
            Sign In
          </Button>
        </Stack>
      </Sheet>
    </Box>
  );
}
