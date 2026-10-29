import {
  Accessibility,
  ArrowRight,
  ChevronRight,
  Clock3,
  CloudRain,
  Construction,
  Info,
  ShieldCheck,
  TrainFront,
  TriangleAlert,
  OctagonAlert,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { DataSource, Incident } from "../types";
import {
  cn,
  formatTime,
  normalize,
  relativeTime,
  severityLabels,
} from "../lib/utils";
import { Badge, Button, EmptyState, ExternalLink, Modal } from "./ui";
import { prioritizeIncidents } from "../lib/safety";

const categoryIcons = {
  Infraestructura: TriangleAlert,
  Catenaria: Zap,
  Circulación: TrainFront,
  Obras: Construction,
  Accesibilidad: Accessibility,
  Meteorología: CloudRain,
  Accidente: OctagonAlert,
};
export function IncidentIcon({
  incident,
  large = false,
}: {
  incident: Incident;
  large?: boolean;
}) {
  const Icon = categoryIcons[incident.category] || Info;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        large ? "size-11" : "size-9",
        incident.severity === "high"
          ? "bg-red-50 text-red-500"
          : incident.severity === "medium"
            ? "bg-amber-50 text-amber-600"
            : "bg-sky-50 text-sky-600",
      )}
    >
      <Icon size={large ? 21 : 17} strokeWidth={1.6} />
    </div>
  );
}
export function IncidentPanel({
  incidents,
  sources,
  demo,
  onSelect,
  onViewAll,
}: {
  incidents: Incident[];
  sources: DataSource[];
  demo: boolean;
  onSelect: (i: Incident) => void;
  onViewAll: () => void;
}) {
  const [tab, setTab] = useState("Todas");
  const filtered = prioritizeIncidents(incidents).filter(
    (i) =>
      tab === "Todas" ||
      (tab === "Adif"
        ? i.sourceId.startsWith("adif-")
        : tab === "Infraestructura"
          ? ["Infraestructura", "Catenaria", "Obras"].includes(i.category)
          : i.category === "Circulación"),
  );
  const stale =
    !demo && sources.some((s) => s.id === "alerts" && s.status !== "ok");
  return (
    <section className="flex h-[540px] flex-col overflow-hidden rounded-xl border border-line bg-white xl:h-[550px]">
      <div className="flex h-[62px] shrink-0 items-center justify-between px-5">
        <h2 className="flex items-center gap-2 font-display text-[13px] font-bold">
          Avisos de la red
          <span className="rounded-md bg-canvas px-1.5 py-1 font-sans text-[10px] font-medium text-muted">
            {incidents.length}
          </span>
        </h2>
        <TriangleAlert size={15} className="text-muted" />
      </div>
      <div className="mx-5 flex gap-4 border-b border-line">
        {["Todas", "Adif", "Infraestructura"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative pb-3 text-[10px] transition-colors",
              tab === t
                ? "font-semibold text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600"
                : "text-muted hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {stale && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-[9px] leading-relaxed text-amber-800">
          <Clock3 size={12} className="mt-.5 shrink-0" />
          Renfe Cercanías: fuente sin actualización reciente. Revisa la fecha de
          cada aviso.
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {filtered.length ? (
          filtered.slice(0, 4).map((i) => (
            <button
              key={i.id}
              onClick={() => onSelect(i)}
              className="group flex w-full gap-3 border-b border-line py-4 text-left last:border-0"
            >
              <IncidentIcon incident={i} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="text-[11px] font-semibold leading-4 group-hover:text-brand-600">
                    {i.title}
                  </h3>
                  <ChevronRight
                    size={12}
                    className="mt-1 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                <p className="mt-1 line-clamp-1 text-[9px] text-muted">
                  {i.location}
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <Badge
                    tone={
                      i.severity === "high"
                        ? "red"
                        : i.severity === "medium"
                          ? "amber"
                          : "blue"
                    }
                  >
                    {i.sourceName ? `${i.sourceName} · ` : ""}
                    {i.category}
                  </Badge>
                  <span className="text-[8px] text-muted">
                    {i.start
                      ? relativeTime(i.start)
                      : i.checkedAt
                        ? `Consulta ${formatTime(i.checkedAt)}`
                        : "Sin fecha publicada"}
                  </span>
                </div>
              </div>
            </button>
          ))
        ) : (
          <EmptyState
            title="Sin avisos en esta vista"
            text="La ausencia de avisos no confirma el estado de la infraestructura."
          />
        )}
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <button
          onClick={onViewAll}
          className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-[10px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Ver todos los avisos
          <ArrowRight size={13} />
        </button>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-line bg-canvas/60 px-3 py-2.5 text-[8px] text-muted">
        <ShieldCheck size={11} />
        {demo
          ? "Avisos ficticios · modo demostración"
          : "Adif + Renfe · avisos públicos, cobertura parcial"}
      </div>
    </section>
  );
}
export function IncidentList({
  incidents,
  onSelect,
}: {
  incidents: Incident[];
  onSelect: (i: Incident) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [severity, setSeverity] = useState("all");
  const [provider, setProvider] = useState("all");
  const filtered = prioritizeIncidents(incidents).filter(
    (i) =>
      (provider === "all" ||
        (provider === "adif"
          ? i.sourceId.startsWith("adif-")
          : i.sourceId === "alerts")) &&
      (category === "Todas" || i.category === category) &&
      (severity === "all" || i.severity === severity) &&
      normalize(`${i.title} ${i.location} ${i.description}`).includes(
        normalize(query),
      ),
  );
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap gap-3 border-b border-line p-5">
        <input
          aria-label="Buscar avisos"
          placeholder="Buscar por estación, línea o descripción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-48 flex-1 rounded-lg border border-line px-3 text-xs"
        />
        <select
          aria-label="Fuente del aviso"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-10 rounded-lg border border-line px-3 text-xs"
        >
          <option value="all">Todas las fuentes</option>
          <option value="adif">Adif</option>
          <option value="renfe">Renfe</option>
        </select>
        <select
          aria-label="Categoría de aviso"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-line px-3 text-xs"
        >
          {["Todas", ...Object.keys(categoryIcons)].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Afectación del aviso"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-line px-3 text-xs"
        >
          <option value="all">Todas las afectaciones</option>
          {Object.entries(severityLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="px-5">
        {filtered.length ? (
          filtered.map((i) => (
            <button
              key={i.id}
              onClick={() => onSelect(i)}
              className="flex w-full items-start gap-4 border-b border-line py-5 text-left last:border-0 hover:bg-brand-50/40"
            >
              <IncidentIcon incident={i} large />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{i.title}</h3>
                  <Badge
                    tone={
                      i.severity === "high"
                        ? "red"
                        : i.severity === "medium"
                          ? "amber"
                          : "blue"
                    }
                  >
                    {i.sourceName ? `${i.sourceName} · ` : ""}
                    {i.category}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{i.location}</p>
                <p className="mt-2 line-clamp-2 max-w-4xl text-xs leading-relaxed text-zinc-500">
                  {i.description}
                </p>
                <p className="mt-2 text-[10px] text-muted">
                  {i.start
                    ? `Publicado: ${formatTime(i.start, true)}`
                    : `Sin fecha individual · consultado ${formatTime(i.checkedAt || null, true)}`}
                </p>
              </div>
              <ChevronRight size={16} className="mt-3 text-muted" />
            </button>
          ))
        ) : (
          <EmptyState
            title="No hay avisos que coincidan"
            text="Prueba otra categoría o cambia la búsqueda. La cobertura de avisos es parcial."
          />
        )}
      </div>
    </section>
  );
}
export function IncidentModal({
  incident,
  demo,
  source,
  onClose,
}: {
  incident: Incident;
  demo: boolean;
  source?: DataSource;
  onClose: () => void;
}) {
  return (
    <Modal title="Detalle del aviso" onClose={onClose}>
      <div className="mb-5 flex items-start gap-4">
        <IncidentIcon incident={incident} large />
        <div>
          <h3 className="font-display text-lg font-bold">{incident.title}</h3>
          <p className="mt-1 text-xs text-muted">{incident.location}</p>
        </div>
      </div>
      <div className="mb-5 flex gap-2">
        <Badge
          tone={
            incident.severity === "high"
              ? "red"
              : incident.severity === "medium"
                ? "amber"
                : "blue"
          }
        >
          {severityLabels[incident.severity]}
        </Badge>
        <Badge tone="gray">{incident.category}</Badge>
        {demo && <Badge tone="amber">Ejemplo simulado</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-600">
        {incident.description}
      </p>
      {incident.summaryOnly && (
        <p className="mt-2 text-[10px] leading-5 text-muted">
          Resumen del listado público de Adif. Abre el boletín oficial para
          consultar el detalle completo y su vigencia.
        </p>
      )}
      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-4 text-xs">
        <div>
          <dt className="text-muted">Fecha de publicación</dt>
          <dd className="mt-1.5 font-medium">
            {formatTime(incident.start, true)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Fuente</dt>
          <dd className="mt-1.5 font-medium">
            {demo
              ? "Demostración de Safel"
              : incident.sourceName || "Renfe Open Data"}
          </dd>
        </div>
        {incident.checkedAt && (
          <div>
            <dt className="text-muted">Última comprobación</dt>
            <dd className="mt-1.5">{formatTime(incident.checkedAt, true)}</dd>
          </div>
        )}
        {source?.timestamp && (
          <div>
            <dt className="text-muted">Fecha de la página / fuente</dt>
            <dd className="mt-1.5">{formatTime(source.timestamp, true)}</dd>
          </div>
        )}
        {incident.end && (
          <div>
            <dt className="text-muted">Fin publicado</dt>
            <dd className="mt-1.5">{formatTime(incident.end, true)}</dd>
          </div>
        )}
      </dl>
      {incident.locationNote && (
        <p className="mt-4 rounded-lg bg-canvas p-3 text-xs leading-6 text-muted">
          {incident.locationNote}
        </p>
      )}
      {(incident.cause || incident.effect) && (
        <p className="mt-3 text-[10px] text-muted">
          Código de causa: {incident.cause || "no publicado"} · efecto:{" "}
          {incident.effect || "no publicado"}
        </p>
      )}
      {source?.status !== "ok" && !demo && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          La fuente está desactualizada o no disponible. Confirma la vigencia de
          este aviso con el operador. Fecha del feed:{" "}
          {formatTime(source?.timestamp || null, true)}.
        </p>
      )}
      <div className="mt-5 flex items-center justify-between">
        <ExternalLink
          href={
            demo
              ? "https://www.adif.es/viajeros/estado-de-la-red"
              : incident.sourceId.startsWith("adif-")
                ? incident.url
                : source?.url || incident.url
          }
          className="text-xs"
        >
          Consultar fuente oficial
        </ExternalLink>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}
