import { useState } from "react";
import { Newspaper, ArrowUpRight } from "lucide-react";
import type { DataSource, RailNews } from "../types";
import { formatTime } from "../lib/utils";

export function RailAccidentNews({
  items,
  sources,
  loading,
}: {
  items: RailNews[];
  sources: DataSource[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const providers = sources.filter((s) => s.id.startsWith("rail-news-"));
  const visible = expanded ? items : items.slice(0, 6);
  return (
    <section
      aria-label="Noticias de accidentes ferroviarios en España"
      className="mb-5 rounded-xl border border-line bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <Newspaper size={19} className="mt-0.5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold">
            Noticias ferroviarias · España
          </h2>
          <p className="mt-1 text-[10px] leading-5 text-muted">
            Búsqueda estatal de publicaciones de las últimas 72 horas. Son
            noticias, no partes operativos: pueden referirse a sucesos
            anteriores. Varios titulares pueden tratar el mismo accidente.
          </p>
          {visible.length > 0 ? (
            <ul className="mt-3 divide-y divide-line">
              {visible.map((item) => (
                <li key={item.id} className="py-3 first:pt-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-3 text-[11px] font-medium leading-5 hover:text-brand-700"
                  >
                    <span>{item.title}</span>
                    <ArrowUpRight size={13} className="mt-1 shrink-0" />
                  </a>
                  <p className="mt-1 text-[9px] leading-5 text-muted">
                    {item.outlet} ·{" "}
                    {item.sourceId === "rail-news-gdelt" ? "Vía GDELT · " : ""}
                    {item.publishedAt
                      ? `Publicado ${formatTime(item.publishedAt, true)}`
                      : `Publicación sin fecha verificada · Indexado ${formatTime(item.indexedAt, true)}`}
                    {sources.find((s) => s.id === item.sourceId)?.status !==
                    "ok"
                      ? " · Datos conservados o lectura parcial"
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] text-zinc-600">
              {loading && !providers.length
                ? "Consultando publicaciones…"
                : providers.some((s) => s.status === "ok")
                  ? "No se han recuperado titulares que coincidan con los filtros. Esto no confirma ausencia de accidentes."
                  : "Las fuentes de noticias no están disponibles. No se puede comprobar si hay publicaciones nuevas."}
            </p>
          )}
          {items.length > 6 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-[10px] font-semibold text-brand-700"
            >
              {expanded
                ? "Mostrar menos"
                : `Ver las ${items.length} publicaciones`}
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
            {providers.map((s) => (
              <p
                key={s.id}
                className="text-[9px] leading-5 text-muted"
                title={s.error}
              >
                {s.id === "rail-news-gdelt" ? "GDELT" : "RTVE"} ·{" "}
                {s.status === "ok"
                  ? "Consulta disponible"
                  : s.status === "stale"
                    ? "Lectura antigua o parcial"
                    : "No disponible"}{" "}
                ·{" "}
                {s.fetchedAt
                  ? `Consulta ${formatTime(s.fetchedAt, true)}`
                  : "Sin descarga válida"}
                {s.error && (
                  <span className="block max-w-xl text-amber-800">
                    {s.error}
                  </span>
                )}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-muted">
            Fuentes:{" "}
            <a
              className="underline"
              href="https://www.gdeltproject.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              The GDELT Project
            </a>{" "}
            y{" "}
            <a
              className="underline"
              href="https://www.rtve.es/noticias/"
              target="_blank"
              rel="noopener noreferrer"
            >
              RTVE Noticias
            </a>
            . Selección automática; consulta el artículo original.
          </p>
        </div>
      </div>
    </section>
  );
}
