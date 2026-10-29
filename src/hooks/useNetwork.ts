import { useCallback, useEffect, useRef, useState } from "react";
import type { NetworkData } from "../types";
import { makeDemoData } from "../data/network";
export function useNetwork(autoRefresh: boolean) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [mode, setMode] = useState<"live" | "demo">(() =>
    new URLSearchParams(window.location.search).get("modo") === "demo"
      ? "demo"
      : "live",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (mode === "demo") {
      setData(makeDemoData());
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    try {
      const response = await fetch("/api/network", { signal: current.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next: NetworkData = await response.json();
      if (!Array.isArray(next.trains) || !Array.isArray(next.sources))
        throw new Error("Respuesta inválida");
      setData(next);
      setError(
        next.sources.every((s) => s.status === "unavailable")
          ? "Las fuentes públicas no responden actualmente."
          : "",
      );
    } catch {
      if (current.signal.aborted) return;
      setError(
        "No se ha podido conectar con las fuentes públicas. Puedes reintentar o explorar la demostración.",
      );
      setData(
        (previous) =>
          previous || {
            trains: [],
            incidents: [],
            sources: [],
            fetchedAt: Math.floor(Date.now() / 1000),
            demo: false,
          },
      );
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    if (mode === "demo") {
      controller.current?.abort();
      setData(makeDemoData());
      setLoading(false);
      setError("");
      return;
    }
    void refresh();
    return () => controller.current?.abort();
  }, [mode, refresh]);
  useEffect(() => {
    if (!autoRefresh || mode === "demo") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [autoRefresh, mode, refresh]);
  const changeMode = (next: "live" | "demo") => {
    if (next === mode) return;
    controller.current?.abort();
    setData(null);
    setError("");
    setLoading(true);
    setMode(next);
  };
  return { data, mode, setMode: changeMode, loading, error, refresh };
}
