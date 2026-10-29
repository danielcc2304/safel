import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  MapPin,
  Radio,
  ShieldQuestion,
  Share2,
  TrainFront,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DataSource, Incident, Train } from "../types";
import { cn, formatTime, relatedIncidents, relativeTime } from "../lib/utils";
import { Badge, Button, ExternalLink, IconButton } from "./ui";
import { DelayBadge } from "./TrainTable";
import { IncidentIcon } from "./Incidents";
import { TelemetryPanel } from "./TrainTelemetry";

export function TrainDetail({
  train,
  incidents,
  source,
  demo,
  saved,
  onSave,
  onClose,
  onIncident,
  onLocate,
}: {
  train: Train;
  incidents: Incident[];
  source?: DataSource;
  demo: boolean;
  saved: boolean;
  onSave: (t: Train) => void;
  onClose: () => void;
  onIncident: (i: Incident) => void;
  onLocate?: () => void;
}) {
  const relevant = relatedIncidents(train, incidents);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(window.location.href);
    url.hash = "map";
    url.searchParams.set("tren", train.number);
    if (demo) url.searchParams.set("modo", "demo");
    else url.searchParams.delete("modo");
    setShareUrl(url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={`Detalle del tren ${train.number}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100%-2rem)] max-w-[680px] overflow-y-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-brand-900/20 backdrop:backdrop-blur-xs"
    >
      <div className="sticky top-0 z-10 flex h-[64px] items-center justify-between border-b border-line bg-white px-6">
        <span className="text-xs text-muted">SEGUIMIENTO DEL TRAYECTO</span>
        <IconButton label="Cerrar detalle del tren" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <TrainFront size={24} strokeWidth={1.5} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold">
                {train.name} {train.number}
              </h2>
              {demo && <Badge tone="amber">Demo</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">{train.service} · Renfe</p>
          </div>
        </div>
        <div className="my-6 flex items-center gap-3 font-display text-lg font-semibold">
          <span>{train.origin || "Origen no publicado"}</span>
          <ArrowRight size={19} className="shrink-0 text-brand-500" />
          <span>{train.destination || "Destino no publicado"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DelayBadge train={train} />
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <Radio size={12} />
            {train.status === "STOPPED_AT"
              ? "En estación según fuente"
              : "Posición publicada"}
          </span>
        </div>
        <Button
          variant={saved ? "secondary" : "primary"}
          className="mt-6 w-full"
          onClick={() => onSave(train)}
        >
          {saved ? <Check size={15} /> : <Bookmark size={15} />}
          {saved ? "Trayecto guardado · dejar de seguir" : "Seguir este tren"}
        </Button>
        <p className="mt-2 text-center text-[9px] text-muted">
          Guardado en este dispositivo. Sin registro.
        </p>
        <Button className="mt-3 w-full" onClick={() => void share()}>
          <Share2 size={14} />
          {copied ? "Enlace copiado" : "Compartir seguimiento"}
        </Button>
        {shareUrl && (
          <label className="mt-3 block text-[10px] text-muted">
            Enlace al número de tren, sin datos personales
            <input
              aria-label="Enlace de seguimiento"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="mt-2 h-8 w-full rounded border border-line px-2 text-[10px] text-ink"
            />
          </label>
        )}
        <TelemetryPanel train={train} demo={demo} />
        {onLocate && (
          <Button variant="primary" className="mt-4 w-full" onClick={onLocate}>
            <MapPin size={14} />
            Localizar y seguir en el mapa
          </Button>
        )}
        <section className="mt-7 border-t border-line pt-5">
          <h3 className="mb-5 font-semibold">Paradas del trayecto</h3>
          {train.stops.length ? (
            <ol className="pl-2">
              {train.stops.map((s, i) => (
                <li
                  key={`${s.id}-${i}`}
                  className={cn(
                    "relative flex min-h-16 items-start justify-between gap-3 border-l border-line pb-5 pl-6",
                    i === train.stops.length - 1 && "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "absolute -left-[4.5px] top-1 size-2 rounded-full ring-4 ring-white",
                      i === 0
                        ? "bg-brand-500"
                        : "border border-brand-400 bg-white",
                    )}
                  />
                  <div>
                    <p className="text-xs font-medium">{s.name}</p>
                    {s.name === train.nextStop && (
                      <p className="mt-1 text-[10px] text-brand-600">
                        Parada indicada en la fuente
                      </p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted">
                    {s.arrival?.slice(0, 5) || "—"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs leading-6 text-muted">
              El feed de posición no incluye un itinerario resoluble para este
              viaje. No se deducen paradas a partir de la ubicación.
            </p>
          )}
          <p className="text-[9px] leading-5 text-muted">
            {train.itinerarySource || "GTFS · horario programado"}. La demora se
            muestra por separado y puede cambiar.
          </p>
        </section>
        <section className="mt-6 border-t border-line pt-5">
          <h3 className="mb-4 font-semibold">
            Avisos asociados{" "}
            <span className="ml-1 text-muted">{relevant.length}</span>
          </h3>
          {relevant.length ? (
            relevant.map((i) => (
              <button
                key={i.id}
                className="mb-3 flex w-full items-center gap-3 rounded-lg bg-canvas p-3 text-left"
                onClick={() => onIncident(i)}
              >
                <IncidentIcon incident={i} />
                <span className="text-xs">{i.title}</span>
              </button>
            ))
          ) : (
            <div className="flex gap-3 rounded-lg bg-canvas p-4">
              <ShieldQuestion size={20} className="shrink-0 text-muted" />
              <p className="text-xs leading-6 text-zinc-500">
                No hay coincidencias por identificador de ruta o parada. Esto no
                confirma que el trayecto esté libre de incidencias.
              </p>
            </div>
          )}
        </section>
        <section className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 font-semibold">Boletines generales de Adif</h3>
          <p className="mb-4 text-[10px] leading-5 text-muted">
            Estos avisos públicos no tienen una asociación confirmada con este
            tren. Comprueba el tramo y el ámbito de cada boletín.
          </p>
          {incidents
            .filter((i) => i.sourceId === "adif-traffic")
            .slice(0, 3)
            .map((i) => (
              <button
                key={i.id}
                onClick={() => onIncident(i)}
                className="mb-2 flex w-full gap-2 rounded-lg bg-canvas p-3 text-left"
              >
                <IncidentIcon incident={i} />
                <span className="text-[11px] leading-5">{i.title}</span>
              </button>
            ))}
          <p className="mt-3 text-[10px] leading-5 text-muted">
            No se dispone de un canal público integrado con los reportes
            internos de maquinistas ni con la telemetría de fallos de vías o
            catenaria.
          </p>
        </section>
        <section className="mt-6 border-t border-line pt-5">
          <h3 className="mb-4 font-semibold">Trazabilidad del dato</h3>
          {train.tripId.match(/\d{4}-\d{2}-\d{2}/) && (
            <p className="mb-4 text-[10px] text-muted">
              Fecha de servicio del identificador:{" "}
              {train.tripId.match(/\d{4}-\d{2}-\d{2}/)?.[0]}
            </p>
          )}
          {train.delayTimestamp && (
            <p className="mb-4 text-[10px] text-muted">
              Fecha del feed de demoras:{" "}
              {formatTime(train.delayTimestamp, true)}
            </p>
          )}
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted">
                <Clock3 size={13} />
                Fecha de la posición
              </dt>
              <dd>{formatTime(train.timestamp, true)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Antigüedad de la posición</dt>
              <dd>{relativeTime(train.timestamp)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted">
                <MapPin size={13} />
                Coordenadas
              </dt>
              <dd>
                {train.lat.toFixed(4)}, {train.lon.toFixed(4)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Estado de la fuente</dt>
              <dd>
                {demo
                  ? "Simulación"
                  : source?.status === "ok"
                    ? "Disponible"
                    : "Sin actualización reciente"}
              </dd>
            </div>
          </dl>
          <ExternalLink
            href={source?.url || "https://data.renfe.com/"}
            className="mt-5 text-xs"
          >
            Ver fuente pública
          </ExternalLink>
        </section>
      </div>
    </dialog>
  );
}
