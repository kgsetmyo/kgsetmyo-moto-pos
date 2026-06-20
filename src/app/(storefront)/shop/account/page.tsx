"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { createClient } from "@/lib/supabase/client";

function AccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/shop/orders";

  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
    window.location.assign(redirect);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/store/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, phone: phone || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Signup failed");
      setLoading(false);
      return;
    }

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
    window.location.assign(redirect);
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography level="h3">Customer account</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v as number)}>
        <TabList>
          <Tab>Sign in</Tab>
          <Tab>Create account</Tab>
        </TabList>
        <TabPanel value={0}>
          <Stack spacing={2} component="form" onSubmit={handleLogin}>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
            {error && <Alert color="danger">{error}</Alert>}
            <Button type="submit" loading={loading}>
              Sign in
            </Button>
          </Stack>
        </TabPanel>
        <TabPanel value={1}>
          <Stack spacing={2} component="form" onSubmit={handleSignup}>
            <FormControl>
              <FormLabel>Full name</FormLabel>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </FormControl>
            <FormControl>
              <FormLabel>Phone</FormLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
            {error && <Alert color="danger">{error}</Alert>}
            <Button type="submit" loading={loading}>
              Create account
            </Button>
          </Stack>
        </TabPanel>
      </Tabs>
      <Button variant="plain" onClick={() => router.push("/shop")}>
        Back to shop
      </Button>
    </Stack>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<Typography>Loading…</Typography>}>
      <AccountForm />
    </Suspense>
  );
}
