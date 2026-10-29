import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink as ExternalLinkIcon,
  MapPin,
  Search,
  ShieldQuestion,
  TrainFront,
  Trash2,
} from "lucide-react";
import type { DataSource, NetworkData, Stop, Train } from "../types";
import { stations } from "../data/network";
import { cn, formatTime, normalize, relativeTime } from "../lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  ExternalLink,
  IconButton,
  Modal,
} from "./ui";
import { TrainTable } from "./TrainTable";

export function SourcesPage({ data }: { data: NetworkData | null }) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-white">
        <div className="border-b border-line px-6 py-5">
          <h2 className="font-display font-bold">
            Información abierta, con contexto
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-muted">
            Safel es un proyecto independiente. Cada dato conserva su fuente y
            fecha. La disponibilidad de un feed no equivale a cobertura completa
            ni a una certificación de seguridad.
          </p>
        </div>
        <div className="divide-y divide-line px-6">
          {data?.sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start gap-4 py-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Database size={18} strokeWidth={1.5} />
              </span>
              <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xs font-semibold">{s.name}</h3>
                  <SourceBadge source={s} demo={data.demo} />
                </div>
                <p className="mt-2 max-w-2xl text-xs leading-6 text-muted">
                  {s.scope}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-zinc-500">
                  <span>Cadencia / consulta: {s.cadence}</span>
                  <span>Fecha del feed: {formatTime(s.timestamp, true)}</span>
                  <span>Consulta: {formatTime(s.fetchedAt, true)}</span>
                </div>
                {s.error && (
                  <p className="mt-2 text-xs text-amber-700">{s.error}</p>
                )}
              </div>
              <ExternalLink href={s.url} className="text-[10px]">
                Consultar
              </ExternalLink>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-white px-6 py-5">
        <h2 className="font-display font-bold">
          Qué puedes consultar en Safel
        </h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="text-[10px] text-muted">
              <tr>
                <th className="pb-3 font-medium">INFORMACIÓN</th>
                <th className="pb-3 font-medium">COBERTURA</th>
                <th className="pb-3 font-medium">ALCANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                [
                  "Posición de trenes",
                  "Integrada",
                  "Visor Renfe AV/LD/MD + GTFS Cercanías; fecha por vehículo cuando existe",
                ],
                [
                  "Retrasos y horarios",
                  "Integrada",
                  "GTFS por viaje exacto; demora propia e itinerarios del visor Renfe",
                ],
                [
                  "Avisos de servicio",
                  "Parcial",
                  "Renfe Cercanías y boletines públicos de tráfico y obras de Adif",
                ],
                [
                  "Vías, catenaria y accidentes",
                  "Parcial",
                  "Boletines HTML de Adif integrados; sin canal interno ni telemetría técnica",
                ],
                [
                  "Velocidad y rumbo",
                  "Parcial",
                  "Campos GTFS si se publican; media estimada solo entre posiciones recientes válidas",
                ],
                [
                  "Advertencias de maquinistas",
                  "Sin cobertura",
                  "No hay un canal público de reportes internos integrado en Safel",
                ],
                [
                  "Iryo, OUIGO y otros operadores",
                  "Sin cobertura",
                  "No se han integrado feeds públicos de estos operadores",
                ],
                [
                  "Meteorología y riesgo predictivo",
                  "Sin cobertura",
                  "No se calcula riesgo ni se emiten predicciones de accidentes",
                ],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td className="py-4 pr-4 font-medium">{a}</td>
                  <td className="py-4 pr-4">
                    <Badge
                      tone={
                        b === "Integrada"
                          ? "green"
                          : b === "Sin cobertura"
                            ? "gray"
                            : "amber"
                      }
                    >
                      {b}
                    </Badge>
                  </td>
                  <td className="py-4 text-muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldQuestion size={17} className="text-brand-600" />
            Estado oficial de la red
          </h3>
          <p className="my-3 text-xs leading-6 text-muted">
            Adif publica información de tráfico e incidencias de
            infraestructura. Safel recoge sus boletines públicos cada 5 minutos.
            La extracción HTML puede fallar o cambiar: consulta el boletín
            original.
          </p>
          <ExternalLink
            href="https://www.adif.es/viajeros/estado-de-la-red"
            className="text-xs"
          >
            Estado de la red · Adif
          </ExternalLink>
        </section>
        <section className="rounded-xl border border-line bg-white p-6">
          <h3 className="font-semibold">Datos y atribución</h3>
          <p className="my-3 text-xs leading-6 text-muted">
            Datos de Renfe Open Data bajo CC BY 4.0, transformados para su
            visualización. Callejero © OpenStreetMap, ortofoto IGN/PNOA y capas
            de OpenRailwayMap. Son cartografía estática, no el estado operativo
            ni los límites vigentes. Contornos de Natural Earth.
          </p>
          <ExternalLink href="https://data.renfe.com/" className="text-xs">
            Portal de datos de Renfe
          </ExternalLink>
        </section>
      </div>
    </div>
  );
}
export function SourceBadge({
  source,
  demo = false,
}: {
  source: DataSource;
  demo?: boolean;
}) {
  return (
    <Badge
      tone={
        demo
          ? "gray"
          : source.status === "ok"
            ? "green"
            : source.status === "stale"
              ? "amber"
              : "red"
      }
    >
      {demo
        ? "Simulada"
        : source.status === "ok"
          ? "Disponible"
          : source.status === "stale"
            ? "Desactualizada"
            : "No disponible"}
    </Badge>
  );
}

export function SavedPage({
  trains,
  saved,
  demo,
  onSave,
  onSelect,
  onExplore,
  onRemove,
}: {
  trains: Train[];
  saved: string[];
  demo: boolean;
  onSave: (t: Train) => void;
  onSelect: (t: Train) => void;
  onExplore: () => void;
  onRemove: (n: string) => void;
}) {
  const current = trains.filter((t) => saved.includes(t.number));
  const missing = saved.filter((n) => !current.some((t) => t.number === n));
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-5">
        <Bookmark size={20} className="mt-1 shrink-0 text-brand-600" />
        <div>
          <h2 className="font-semibold text-brand-800">
            Sigue los trayectos que te importan
          </h2>
          <p className="mt-1 text-xs leading-6 text-brand-700">
            Tus trenes se guardan por número en este dispositivo. Con la página
            abierta y la actualización automática activada, verás cambios de
            demora en el centro de avisos. No se envían notificaciones en
            segundo plano.
          </p>
        </div>
      </div>
      {saved.length ? (
        <>
          <TrainTable
            trains={current}
            demo={demo}
            saved={saved}
            onSave={onSave}
            onSelect={onSelect}
          />
          {missing.length > 0 && (
            <div className="rounded-xl border border-line bg-white px-5">
              <p className="pt-5 text-xs text-muted">
                Guardados sin posición en la última consulta. Puede que aún no
                circulen o que no publiquen ubicación.
              </p>
              {missing.map((n) => (
                <div
                  key={n}
                  className="flex items-center justify-between border-b border-line py-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <TrainFront size={17} className="text-muted" />
                    <span className="text-xs font-semibold">Tren {n}</span>
                    <Badge tone="gray">Sin posición publicada</Badge>
                  </div>
                  <IconButton
                    label={`Eliminar tren ${n} de guardados`}
                    onClick={() => onRemove(n)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-line bg-white">
          <EmptyState
            title="Tu próximo trayecto empieza aquí"
            text="Busca un tren y pulsa el marcador para tenerlo siempre a mano. También puedes guardar el tren en el que viaja alguien cercano."
            action={
              <Button variant="primary" onClick={onExplore}>
                <Search size={14} />
                Buscar un tren
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}
export function StationsPage({
  trains,
  catalogStations = [],
  demo,
  onSelect,
}: {
  trains: Train[];
  catalogStations?: Stop[];
  demo: boolean;
  onSelect: (s: Stop) => void;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const all = new Map<string, Stop>();
    if (!demo) for (const s of catalogStations) all.set(s.id, s);
    for (const t of trains) for (const s of t.stops) all.set(s.id, s);
    if (demo) for (const s of stations) all.set(s.id, s);
    return [...all.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .filter((s) => normalize(s.name).includes(normalize(query)));
  }, [trains, catalogStations, demo, query]);
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 className="font-display font-bold">
            Catálogo de estaciones de Renfe
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            {list.length} estaciones · aparecen aunque no haya trenes
            localizados ahora. No es un panel completo de salidas.
          </p>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line px-3">
          <Search size={14} className="text-muted" />
          <input
            aria-label="Buscar estaciones"
            placeholder="Buscar una estación…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs"
          />
        </label>
      </div>
      <div className="grid divide-line md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="flex items-center gap-3 border-b border-line p-5 text-left transition-colors hover:bg-brand-50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-brand-600">
              <MapPin size={18} strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {s.name}
              </span>
              <span className="mt-1 block text-[10px] text-muted">
                {
                  trains.filter((t) => t.stops.some((p) => p.id === s.id))
                    .length
                }{" "}
                trenes en la muestra
              </span>
            </span>
            <ArrowRight size={13} className="text-muted" />
          </button>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title="Sin estaciones para esta consulta"
          text="Prueba otro nombre o revisa la disponibilidad del catálogo en Fuentes y cobertura."
        />
      )}
    </section>
  );
}
export function StationModal({
  station,
  trains,
  onSelect,
  onClose,
}: {
  station: Stop;
  trains: Train[];
  onSelect: (t: Train) => void;
  onClose: () => void;
}) {
  const passing = trains.filter((t) =>
    t.stops.some((s) => s.id === station.id),
  );
  return (
    <Modal title={station.name} onClose={onClose}>
      <div className="flex gap-3 rounded-lg bg-canvas p-4">
        <MapPin size={21} className="shrink-0 text-brand-600" />
        <div>
          <p className="text-xs font-semibold">
            Estación · código {station.id}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            {station.lat.toFixed(4)}, {station.lon.toFixed(4)}
          </p>
        </div>
      </div>
      <h3 className="mb-2 mt-6 font-semibold">
        Trenes con parada en la muestra
      </h3>
      <p className="mb-4 text-[10px] leading-5 text-muted">
        No es un panel completo de llegadas y salidas. Se muestran solo los
        viajes localizados que incluyen esta parada.
      </p>
      {passing.length ? (
        passing.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onClose();
              onSelect(t);
            }}
            className="flex w-full items-center justify-between border-t border-line py-4 text-left text-xs"
          >
            <span className="flex items-center gap-2">
              <TrainFront size={14} className="text-brand-600" />
              <strong>
                {t.name} {t.number}
              </strong>
            </span>
            <span className="text-muted">
              {t.destination}
              <ArrowRight size={12} className="ml-2 inline" />
            </span>
          </button>
        ))
      ) : (
        <EmptyState
          title="Sin trenes asociados"
          text="No hay trenes localizados asociados a esta estación en esta consulta. Esto no significa que la estación no tenga servicio ni salidas programadas."
        />
      )}
      <ExternalLink
        href="https://www.adif.es/viajeros/estaciones"
        className="mt-5 text-xs"
      >
        Información oficial de estaciones
      </ExternalLink>
    </Modal>
  );
}
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Te ayudamos a orientarte" onClose={onClose}>
      <div className="mb-6 flex items-center gap-3 text-brand-700">
        <CircleHelp size={24} />
        <p className="font-display font-semibold">
          Un poco de contexto para tu viaje.
        </p>
      </div>
      <div className="space-y-6">
        {[
          [
            "¿Cómo encuentro un tren?",
            "Introduce el número de tren de tu billete, una estación o un destino en el buscador del mapa o de la sección Trenes. Los servicios sin coordenadas publicadas no aparecen en el mapa.",
          ],
          [
            "¿Los datos son en tiempo real?",
            "Safel consulta las posiciones cada 20 segundos con la pestaña visible. Combina el visor Renfe con GTFS como alternativa y conserva la antigüedad de cada posición. Los boletines de Adif se consultan cada 5 minutos. La cadencia del publicador no está garantizada.",
          ],
          [
            "¿Qué velocidad estoy viendo?",
            "Se muestra la velocidad GTFS cuando está publicada. Si falta, puede calcularse una media rectilínea entre dos posiciones propias separadas entre 5 y 180 segundos, etiquetada Media estimada. No es una medición instantánea ni permite detectar excesos de velocidad.",
          ],
          [
            "¿Veo advertencias de los maquinistas?",
            "Se muestran boletines públicos de Adif y avisos de Renfe. No hay conexión con reportes internos de maquinistas, libros de averías o telemetría de señalización. Un fallo puede no estar publicado aquí.",
          ],
          [
            "¿Un tren sin avisos es un tren seguro?",
            "La ausencia de avisos no garantiza la seguridad. Safel no tiene acceso a todos los sistemas de infraestructura, señalización ni a la información interna de los operadores.",
          ],
          [
            "¿Puedo seguir el viaje de un familiar?",
            "Sí. Busca su número de tren y pulsa Seguir este tren. Se guarda en este navegador. Los cambios de demora se avisan dentro de la página mientras esté abierta y actualizándose.",
          ],
          [
            "¿Qué significa demostración?",
            "Todos los trenes, horarios e incidencias de ese modo son ficticios y sirven para explorar las funciones. Puedes volver a las fuentes públicas desde el selector superior.",
          ],
        ].map(([q, a]) => (
          <div key={q}>
            <h3 className="text-sm font-semibold">{q}</h3>
            <p className="mt-2 text-xs leading-6 text-muted">{a}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <ExternalLink
          href="https://www.adif.es/viajeros/estado-de-la-red"
          className="text-xs"
        >
          Consultar estado oficial de la red
        </ExternalLink>
      </div>
    </Modal>
  );
}
export function SettingsModal({
  autoRefresh,
  setAutoRefresh,
  showStations,
  setShowStations,
  onClose,
}: {
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  showStations: boolean;
  setShowStations: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Tus preferencias" onClose={onClose}>
      <p className="mb-5 text-xs leading-6 text-muted">
        Se guardan únicamente en este navegador.
      </p>
      {[
        {
          value: autoRefresh,
          set: setAutoRefresh,
          label: "Actualización automática",
          description:
            "Consultar las posiciones cada 20 segundos con la página visible.",
        },
        {
          value: showStations,
          set: setShowStations,
          label: "Estaciones en el mapa",
          description: "Mostrar las principales estaciones como referencia.",
        },
      ].map((o) => (
        <label
          key={o.label}
          className="flex cursor-pointer items-center gap-5 border-t border-line py-5"
        >
          <span className="flex-1">
            <span className="block text-xs font-semibold">{o.label}</span>
            <span className="mt-2 block text-[11px] leading-5 text-muted">
              {o.description}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={o.value}
            onChange={(e) => o.set(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "relative h-6 w-10 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500",
              o.value ? "bg-brand-600" : "bg-zinc-200",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-4 rounded-full bg-white shadow-xs transition-transform",
                o.value ? "translate-x-5" : "translate-x-1",
              )}
            />
          </span>
        </label>
      ))}
      <Button variant="primary" className="mt-5 w-full" onClick={onClose}>
        <Check size={14} />
        Listo
      </Button>
    </Modal>
  );
}
export interface UpdateNotice {
  id: string;
  text: string;
  at: number;
}
export function NotificationsModal({
  notices,
  savedCount,
  onClose,
}: {
  notices: UpdateNotice[];
  savedCount: number;
  onClose: () => void;
}) {
  return (
    <Modal title="Centro de avisos" onClose={onClose}>
      <p className="mb-5 text-xs leading-6 text-muted">
        Comunicados sobre accidentes nuevos o actualizados y cambios de demora
        de tus {savedCount} trenes guardados durante esta sesión. Safel debe
        permanecer abierto y actualizándose. Una nueva detección no implica que
        el accidente haya ocurrido ahora.
      </p>
      {notices.length ? (
        notices.map((n) => (
          <div key={n.id} className="flex gap-3 border-t border-line py-4">
            <Clock3 size={17} className="mt-1 text-brand-600" />
            <div>
              <p className="text-xs leading-6">{n.text}</p>
              <p className="mt-1 text-[10px] text-muted">
                {relativeTime(n.at)}
              </p>
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          title="Sin nuevos cambios"
          text="Aquí aparecerán las variaciones de demora que se detecten en los trenes que sigues."
        />
      )}
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-canvas p-3 text-[10px] text-muted">
        <ExternalLinkIcon size={12} />
        No se envían correos ni alertas con la página cerrada.
      </div>
    </Modal>
  );
}
