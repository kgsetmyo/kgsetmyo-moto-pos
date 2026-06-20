"use client";

import { useState } from "react";
import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { jsonFetcher } from "@/lib/api/fetcher";

interface SettingsFormProps {
  initial: Record<string, unknown>;
  onSaved: () => void;
}

function SettingsForm({ initial, onSaved }: SettingsFormProps) {
  const [businessName, setBusinessName] = useState(() => String(initial.businessName ?? ""));
  const [phone, setPhone] = useState(() => String(initial.phone ?? ""));
  const [address, setAddress] = useState(() => String(initial.address ?? ""));
  const [logoUrl, setLogoUrl] = useState(() => String(initial.logoUrl ?? ""));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          phone: phone || null,
          address: address || null,
          logoUrl: logoUrl || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Save failed");
      setMessage("Settings saved. Receipts will use the updated shop name.");
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined" component="form" onSubmit={save}>
      <Stack spacing={2}>
        <FormControl required>
          <FormLabel>Business name</FormLabel>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>Phone</FormLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09…" />
        </FormControl>
        <FormControl>
          <FormLabel>Address</FormLabel>
          <Textarea
            minRows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shop address for receipts"
          />
        </FormControl>
        <FormControl>
          <FormLabel>Logo URL (optional)</FormLabel>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
        </FormControl>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button type="submit" loading={saving}>
            Save Settings
          </Button>
          {message && (
            <Typography
              level="body-sm"
              color={message.includes("saved") ? "success" : "danger"}
            >
              {message}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR("/api/settings", jsonFetcher);

  const formKey = data
    ? `${data.businessName ?? ""}|${data.phone ?? ""}|${data.address ?? ""}|${data.logoUrl ?? ""}`
    : "loading";

  return (
    <Stack spacing={3}>
      <Typography level="h2">Shop Settings</Typography>

      <Alert color="neutral" variant="soft">
        These details appear on thermal receipts and customer-facing printouts.
      </Alert>

      {isLoading || !data ? (
        <Card variant="outlined">
          <CardSkeleton />
        </Card>
      ) : (
        <SettingsForm key={formKey} initial={data} onSaved={() => void mutate()} />
      )}
    </Stack>
  );
}
