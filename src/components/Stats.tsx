import {
  Activity,
  Database,
  Info,
  TrainFront,
  TriangleAlert,
} from "lucide-react";
import type { NetworkData } from "../types";
import { cn } from "../lib/utils";
export function Stats({
  data,
  loading,
}: {
  data: NetworkData | null;
  loading: boolean;
}) {
  const delayed =
    data?.trains.filter((t) => t.delay !== null && t.delay > 0).length || 0;
  const fresh = data?.sources.filter((s) => s.status === "ok").length || 0;
  const metrics = [
    {
      label: "Trenes localizados",
      value: data?.trains.length || 0,
      suffix: "",
      detail: "Con posición publicada",
      icon: TrainFront,
      color: "text-brand-600 bg-brand-50",
      spark: true,
    },
    {
      label: "Avisos publicados",
      value: data?.incidents.length || 0,
      suffix: "",
      detail: "Revisa su fecha de origen",
      icon: TriangleAlert,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Servicios con demora",
      value: delayed,
      suffix: "",
      detail: "En la muestra de trenes",
      icon: Activity,
      color: "text-sky-600 bg-sky-50",
    },
    {
      label: "Fuentes disponibles",
      value: fresh,
      suffix: ` / ${data?.sources.length || 11}`,
      detail: data?.demo
        ? "Entorno de demostración"
        : "Consultas con respuesta válida",
      icon: Database,
      color: "text-violet-500 bg-violet-50",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      {metrics.map(
        ({ label, value, suffix, detail, icon: Icon, color, spark }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl border border-line bg-white px-4 py-4 xl:px-5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-zinc-500">{label}</span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg",
                  color,
                )}
              >
                <Icon size={15} strokeWidth={1.7} />
              </span>
            </div>
            <div className="mt-1.5 flex items-end justify-between">
              <div className="font-display text-[29px] font-bold leading-none tracking-tight">
                {loading && !data ? (
                  <span className="inline-block h-7 w-12 animate-pulse rounded bg-canvas" />
                ) : (
                  value.toLocaleString("es-ES")
                )}
                <span className="text-base font-medium text-muted">
                  {suffix}
                </span>
              </div>
            </div>
            <p className="mt-2.5 flex items-center gap-1 text-[9px] text-muted">
              {spark ? (
                <span className="size-1 rounded-full bg-brand-500" />
              ) : (
                <Info size={10} />
              )}
              {detail}
            </p>
          </div>
        ),
      )}
    </div>
  );
}
