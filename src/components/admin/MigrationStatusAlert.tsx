"use client";

import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { jsonFetcher } from "@/lib/api/fetcher";

export function MigrationStatusAlert() {
  const { data } = useSWR("/api/migrations/status", jsonFetcher);

  if (!data || data.allInstalled) return null;

  return (
    <Alert color="warning" variant="soft" startDecorator={<InfoOutlinedIcon />}>
      <Stack spacing={1}>
        <Typography level="title-sm">Optional database migrations pending</Typography>
        <Typography level="body-sm">
          {data.pending?.map((item: { label: string }) => item.label).join(" · ")}
        </Typography>
        <Typography level="body-xs" textColor="neutral.600">
          {data.applyHint}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="sm"
            variant="outlined"
            onClick={() => {
              void navigator.clipboard.writeText(
                "npm run migrate:bundle\n# Paste supabase/migrations/optional_bundle.sql in Supabase SQL Editor"
              );
              alert("Instructions copied to clipboard.");
            }}
          >
            Copy instructions
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
