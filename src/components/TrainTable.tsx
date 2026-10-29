import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Search,
  TrainFront,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Train } from "../types";
import { cn, downloadCsv, matchesTrain } from "../lib/utils";
import { Badge, Button, EmptyState, IconButton } from "./ui";
import { SpeedValue } from "./TrainTelemetry";

export function DelayBadge({ train }: { train: Train }) {
  if (train.canceled) return <Badge tone="red">Cancelado en fuente</Badge>;
  if (train.delay === null)
    return <Badge tone="gray">Sin dato de demora</Badge>;
  if (train.delayStale)
    return (
      <Badge tone="gray">
        <Clock3 size={10} />
        Último dato: {train.delay > 0 ? "+" : ""}
        {train.delay} min
      </Badge>
    );
  if (train.delay > 0)
    return (
      <Badge tone="amber">
        <Clock3 size={10} />+{train.delay} min
      </Badge>
    );
  return (
    <Badge>
      <Check size={10} />
      {train.delay < 0 ? `${train.delay} min` : "En hora según fuente"}
    </Badge>
  );
}
export function TrainTable({
  trains,
  demo,
  saved,
  onSave,
  onSelect,
  compact = false,
  onViewAll,
  externalQuery = "",
}: {
  trains: Train[];
  demo: boolean;
  saved: string[];
  onSave: (t: Train) => void;
  onSelect: (t: Train) => void;
  compact?: boolean;
  onViewAll?: () => void;
  externalQuery?: string;
}) {
  const [service, setService] = useState("Todos");
  const [query, setQuery] = useState(externalQuery);
  const [sort, setSort] = useState<"number" | "delay">("number");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      trains
        .filter(
          (t) =>
            (service === "Todos" || t.service === service) &&
            matchesTrain(t, query),
        )
        .sort((a, b) =>
          sort === "delay"
            ? (b.delay ?? -999) - (a.delay ?? -999)
            : a.number.localeCompare(b.number),
        ),
    [trains, service, query, sort],
  );
  const pageSize = compact ? 5 : 12;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
        <h2 className="flex items-center gap-2 font-display text-[13px] font-bold">
          {compact ? "Trenes en la red" : "Explorar trenes"}
          <span className="rounded bg-canvas px-1.5 py-1 font-sans text-[10px] font-medium text-muted">
            {filtered.length}
          </span>
        </h2>
        <div className="flex gap-2">
          {compact && onViewAll ? (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1.5 text-[10px] font-medium text-brand-700"
            >
              Ver todos
              <ArrowRight size={12} />
            </button>
          ) : (
            <Button onClick={() => downloadCsv(filtered, demo)}>
              <Download size={13} />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5">
        <div className="flex max-w-full gap-4 overflow-x-auto">
          {[
            "Todos",
            "Alta velocidad",
            "Larga distancia",
            "Cercanías",
            "Media distancia",
          ].map((s) => (
            <button
              key={s}
              onClick={() => {
                setService(s);
                setPage(0);
              }}
              className={cn(
                "relative shrink-0 pb-3 text-[10px]",
                service === s
                  ? "font-semibold text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600"
                  : "text-muted hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {!compact && (
          <div className="mb-3 flex h-8 items-center gap-2 rounded-lg border border-line px-3">
            <Search size={13} className="text-muted" />
            <input
              aria-label="Buscar trenes"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Número, origen o destino"
              className="w-44 text-[11px]"
            />
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="h-10 bg-canvas/50 text-[9px] font-medium tracking-wide text-muted">
              <th className="pl-5 font-medium">TREN</th>
              <th className="min-w-60 font-medium">TRAYECTO</th>
              <th className="hidden min-w-36 font-medium md:table-cell">
                PRÓXIMA ESTACIÓN
              </th>
              <th className="min-w-28 font-medium">VELOCIDAD</th>
              <th className="min-w-32 font-medium">
                <button
                  onClick={() =>
                    setSort((s) => (s === "delay" ? "number" : "delay"))
                  }
                  className="inline-flex items-center gap-1.5"
                >
                  DEMORA
                  <ArrowDownUp size={10} />
                </button>
              </th>
              <th className="w-10">
                <span className="sr-only">Guardar trayecto</span>
              </th>
              <th className="w-10">
                <span className="sr-only">Ver detalle</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * pageSize, currentPage * pageSize + pageSize)
              .map((t) => (
                <tr
                  key={t.id}
                  className="h-[65px] border-t border-line transition-colors hover:bg-brand-50/40"
                >
                  <td className="pl-5 pr-3">
                    <button
                      onClick={() => onSelect(t)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-zinc-500">
                        <TrainFront size={15} strokeWidth={1.6} />
                      </span>
                      <span>
                        <span className="block whitespace-nowrap font-semibold">
                          {t.name}{" "}
                          <span className="font-medium">{t.number}</span>
                        </span>
                        <span className="mt-1 block text-[9px] text-muted">
                          {t.service}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="pr-5">
                    <button
                      onClick={() => onSelect(t)}
                      className="flex max-w-72 items-center gap-2 text-left"
                    >
                      <span className="truncate">
                        {t.origin || "Origen no publicado"}
                      </span>
                      <ArrowRight size={12} className="shrink-0 text-muted" />
                      <span className="truncate">
                        {t.destination || "Destino no publicado"}
                      </span>
                    </button>
                  </td>
                  <td className="hidden pr-4 md:table-cell">
                    <span className="block max-w-44 truncate text-zinc-500">
                      {t.nextStop || "No publicada"}
                    </span>
                  </td>
                  <td className="pr-3">
                    <SpeedValue train={t} compact />
                  </td>
                  <td className="pr-3">
                    <DelayBadge train={t} />
                  </td>
                  <td>
                    <IconButton
                      label={
                        saved.includes(t.number)
                          ? `Dejar de seguir tren ${t.number}`
                          : `Seguir tren ${t.number}`
                      }
                      onClick={() => onSave(t)}
                    >
                      <Bookmark
                        size={15}
                        className={
                          saved.includes(t.number)
                            ? "fill-brand-100 text-brand-600"
                            : ""
                        }
                      />
                    </IconButton>
                  </td>
                  <td className="pr-3">
                    <IconButton
                      label={`Ver tren ${t.number}`}
                      onClick={() => onSelect(t)}
                    >
                      <ChevronRight size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <EmptyState
          title="No se han encontrado trenes"
          text="Cambia la búsqueda o el tipo de servicio. Solo se muestran trenes con coordenadas publicadas."
        />
      )}
      {!compact && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[10px] text-muted">
          <span>
            {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, filtered.length)} de{" "}
            {filtered.length} trenes
          </span>
          <div className="flex items-center gap-2">
            <IconButton
              label="Página anterior"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={14} />
            </IconButton>
            <span>
              {currentPage + 1} / {Math.ceil(filtered.length / pageSize)}
            </span>
            <IconButton
              label="Página siguiente"
              disabled={(currentPage + 1) * pageSize >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={14} />
            </IconButton>
          </div>
        </div>
      )}
    </section>
  );
}
