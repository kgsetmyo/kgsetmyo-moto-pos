"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useWebOrderAlerts(enabled: boolean) {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const supabase = createClient();

    async function refreshCount() {
      const res = await fetch("/api/web-orders?status=PENDING");
      if (!res.ok) return;
      const body = await res.json();
      setPendingCount((body.orders as unknown[])?.length ?? 0);
    }

    refreshCount();

    const channel = supabase
      .channel("web-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales", filter: "source=eq.WEB" },
        (payload) => {
          const invoice =
            (payload.new as { invoice_number?: string }).invoice_number ?? "New order";
          setLastAlert(`New web order: ${invoice}`);
          setPendingCount((c) => c + 1);
          try {
            if (!audioRef.current) {
              audioRef.current = new Audio(
                "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQQAAAAAAA=="
              );
            }
            void audioRef.current.play();
          } catch {
            /* autoplay blocked */
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sales", filter: "source=eq.WEB" },
        () => {
          void refreshCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { pendingCount, lastAlert, clearAlert: () => setLastAlert(null) };
}
