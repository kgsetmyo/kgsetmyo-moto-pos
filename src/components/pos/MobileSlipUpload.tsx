"use client";

import { useRef, useState } from "react";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import UploadIcon from "@mui/icons-material/Upload";

interface MobileSlipUploadProps {
  slipUrl?: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
}

export function MobileSlipUpload({ slipUrl, onUploaded, onClear }: MobileSlipUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/slip", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUploaded(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Stack spacing={1}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {slipUrl ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="body-xs" color="success">
            Slip uploaded ✓
          </Typography>
          <Button size="sm" variant="plain" onClick={onClear}>
            Remove
          </Button>
        </Stack>
      ) : (
        <Button
          size="sm"
          variant="outlined"
          startDecorator={<UploadIcon />}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Upload payment slip
        </Button>
      )}
      {error && (
        <Typography level="body-xs" color="danger">
          {error}
        </Typography>
      )}
    </Stack>
  );
}
