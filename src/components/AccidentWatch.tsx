import {
  OctagonAlert,
  ShieldQuestion,
  ArrowUpRight,
  LoaderCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import type { DataSource, Incident } from "../types";
import {
  accidentCoverage,
  accidentEvidence,
  prioritizeIncidents,
} from "../lib/safety";
import { formatTime } from "../lib/utils";
import { useNow } from "./TrainTelemetry";

export function AccidentWatch({
  incidents,
  sources,
  loading,
  failed,
  demo,
  onSelect,
}: {
  incidents: Incident[];
  sources: DataSource[];
  loading: boolean;
  failed: boolean;
  demo: boolean;
  onSelect: (i: Incident) => void;
}) {
  const now = useNow();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const reports = prioritizeIncidents(incidents).filter(
    (i) => accidentEvidence(`${i.title}. ${i.description}`) === "reported",
  );
  const uncertain =
    accidentCoverage(sources, failed, now / 1000) === "unverified";
  const adif = sources.find((s) => s.id === "adif-traffic");
  const contentKey = JSON.stringify([
    demo,
    reports.map((i) => [i.id, i.title, i.description]),
  ]);
  if (dismissed === contentKey)
    return (
      <button
        onClick={() => setDismissed(null)}
        className="mb-5 inline-flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline"
      >
        <ShieldQuestion size={15} /> Mostrar comunicados de accidentes
      </button>
    );
  return (
    <section
      aria-label="Vigilancia de accidentes publicados"
      className={`relative mb-5 rounded-xl border p-4 pr-12 ${reports.length ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/60"}`}
    >
      <button
        onClick={() => setDismissed(contentKey)}
        aria-label="Cerrar comunicados de accidentes"
        className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-black/5 hover:text-zinc-800"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {loading ? (
            <LoaderCircle size={19} className="animate-spin text-amber-700" />
          ) : reports.length ? (
            <OctagonAlert size={20} className="text-red-700" />
          ) : (
            <ShieldQuestion size={20} className="text-amber-700" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold">
            {demo ? "Demostración · " : ""}
            {loading && !sources.length
              ? "Comprobando fuentes de accidentes…"
              : reports.length
                ? `${reports.length} comunicados con mención de accidente · comprobar vigencia`
                : uncertain && !demo
                  ? "Vigilancia de accidentes · cobertura limitada"
                  : "Sin menciones de accidente en los datos recuperados"}
          </h2>
          <p className="mt-1 text-[10px] leading-5 text-zinc-600">
            {demo
              ? "Datos ficticios. Cambia a Fuentes públicas para consultar comunicados oficiales."
              : uncertain
                ? "Se consultan avisos oficiales y noticias nacionales. Las fuentes pueden estar incompletas o sin actualizar: no permiten confirmar la ausencia de accidentes en toda la red. Sin acceso a partes internos de maquinistas."
                : "Cobertura pública parcial. Ausencia de avisos no significa ausencia de accidentes. Sin partes internos de maquinistas."}
          </p>
          {!demo && adif?.delivery === "snapshot" && (
            <p className="mt-1 text-[10px] leading-5 text-amber-800">
              Adif · copia de respaldo descargada{" "}
              {formatTime(adif.fetchedAt, true)}. Comprueba la vigencia de cada
              comunicado.
            </p>
          )}
          {reports.length > 0 && (
            <div className="mt-3 space-y-2">
              {reports.map((i) => (
                <button
                  key={i.id}
                  onClick={() => onSelect(i)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-red-100 bg-white px-3 py-2.5 text-left hover:border-red-300"
                >
                  <span>
                    <span className="block text-[11px] font-semibold text-red-900">
                      {i.title}
                    </span>
                    <span className="mt-1 block text-[9px] text-muted">
                      {i.sourceName || i.sourceId} ·{" "}
                      {i.start
                        ? `Publicado ${formatTime(i.start, true)}`
                        : "Sin fecha individual publicada"}{" "}
                      · Consulta{" "}
                      {formatTime(
                        i.checkedAt ||
                          sources.find((s) => s.id === i.sourceId)?.fetchedAt ||
                          null,
                        true,
                      )}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={13}
                    className="mt-1 shrink-0 text-red-700"
                  />
                </button>
              ))}
            </div>
          )}
          {reports.length > 1 && (
            <p className="mt-2 text-[9px] text-muted">
              Varios comunicados pueden referirse al mismo suceso; este número
              no cuenta accidentes distintos.
            </p>
          )}
          <a
            href="https://www.adif.es/viajeros/estado-de-la-red"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700 underline"
          >
            Comprobar el estado oficial de Adif
            <ArrowUpRight size={11} />
          </a>
        </div>
      </div>
    </section>
  );
}
