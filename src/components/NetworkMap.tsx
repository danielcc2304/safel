import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import {
  Crosshair,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Search,
  TrainFront,
  X,
  RefreshCw,
  Navigation,
} from "lucide-react";
import type { Incident, Stop, Train } from "../types";
import { corridors, stations } from "../data/network";
import { cn, normalize } from "../lib/utils";
import { Dot, IconButton } from "./ui";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { MapLayersControl, RasterLayers, railNames } from "./MapLayers";
import type { BaseMap, RailLayer } from "./MapLayers";
import { ageText, SpeedValue } from "./TrainTelemetry";
import { DelayBadge } from "./TrainTable";

const trainSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M9 3v8m6-8v8M8 21l2-3m6 3-2-3"/><path d="M8 15h1m6 0h1"/></svg>';
function trainIcon(train: Train, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span class="train-pin${(train.delay || 0) > 0 ? " delayed" : ""}${train.positionStale ? " stale" : ""}${selected ? " selected" : ""}">${trainSvg}</span>`,
    iconSize: [27, 27],
    iconAnchor: [13, 13],
  });
}
const alertIcon = L.divIcon({
  className: "",
  html: '<span class="alert-pin">!</span>',
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});
const initialCenter: L.LatLngExpression = [40.05, -3.6];
function TrainMarkers({
  trains,
  selected,
  onSelect,
}: {
  trains: Train[];
  selected: Train | null;
  onSelect: (t: Train) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = new Map<string, Train[]>();
  for (const train of trains) {
    const point = map.project([train.lat, train.lon], zoom);
    const key =
      zoom >= 10 || train.id === selected?.id
        ? train.id
        : `${Math.floor(point.x / 31)}-${Math.floor(point.y / 31)}`;
    const existing = groups.get(key);
    if (existing) existing.push(train);
    else groups.set(key, [train]);
  }
  return (
    <>
      {[...groups.entries()].map(([key, group]) => {
        if (group.length === 1) {
          const t = group[0];
          return (
            <Marker
              key={t.id}
              position={[t.lat, t.lon]}
              icon={trainIcon(t, t.id === selected?.id)}
              title={`${t.name} ${t.number}`}
              eventHandlers={{ click: () => onSelect(t) }}
            >
              <Tooltip>
                <span className="font-semibold">
                  {t.name} {t.number}
                </span>
                <br />
                {t.origin || "Origen no publicado"} →{" "}
                {t.destination || "Destino no publicado"}
              </Tooltip>
            </Marker>
          );
        }
        const lat = group.reduce((sum, t) => sum + t.lat, 0) / group.length;
        const lon = group.reduce((sum, t) => sum + t.lon, 0) / group.length;
        return (
          <Marker
            key={key}
            position={[lat, lon]}
            title={`${group.length} trenes. Acercar para explorar.`}
            icon={L.divIcon({
              className: "",
              html: `<span class="train-cluster">${group.length}</span>`,
              iconSize: [33, 33],
              iconAnchor: [16, 16],
            })}
            eventHandlers={{
              click: () => map.flyTo([lat, lon], zoom + 2, { duration: 0.5 }),
            }}
          >
            <Tooltip>{group.length} trenes · pulsa para acercar</Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
function MapController({
  selected,
  full,
  region,
  command,
  follow,
}: {
  selected: Train | null;
  full: boolean;
  region: string;
  command: { name: string; count: number };
  follow: boolean;
}) {
  const map = useMap();
  const previousRegion = useRef(region);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, full]);
  useEffect(() => {
    if (selected)
      map.flyTo([selected.lat, selected.lon], Math.max(map.getZoom(), 9), {
        duration: 0.7,
      });
  }, [selected?.id, map]);
  useEffect(() => {
    if (selected && follow)
      map.panTo([selected.lat, selected.lon], { duration: 0.5 });
  }, [selected?.lat, selected?.lon, follow, map]);
  useEffect(() => {
    const regionChanged = previousRegion.current !== region;
    previousRegion.current = region;
    if (selected && !regionChanged) return;
    const positions: Record<string, [number, number, number]> = {
      all: [40.05, -3.6, 6],
      north: [42.5, -4.3, 7],
      east: [40.55, 0.1, 7],
      center: [40.2, -3.7, 8],
      south: [37.35, -4.6, 7],
    };
    const p = positions[region] || positions.all;
    if (region === "all")
      map.fitBounds(
        [
          [35.7, -9.6],
          [44.3, 3.7],
        ],
        { paddingTopLeft: [25, 65], paddingBottomRight: [50, 45] },
      );
    else map.flyTo([p[0], p[1]], p[2], { duration: 0.6 });
  }, [region, map]);
  useEffect(() => {
    if (command.name === "in") map.zoomIn();
    if (command.name === "out") map.zoomOut();
    if (command.name === "reset")
      map.fitBounds(
        [
          [35.7, -9.6],
          [44.3, 3.7],
        ],
        { paddingTopLeft: [25, 65], paddingBottomRight: [50, 45] },
      );
  }, [command, map]);
  return null;
}
export function NetworkMap({
  trains,
  searchStations = [],
  incidents,
  selected,
  onSelect,
  onDetails,
  onIncident,
  query,
  setQuery,
  demo,
  showStations,
  onStation,
  loading,
  onClearSelection,
  unlocatedCount = 0,
  onUnlocated,
  onUnlocatedIncidents,
}: {
  trains: Train[];
  searchStations?: Stop[];
  incidents: Incident[];
  selected: Train | null;
  onSelect: (t: Train) => void;
  onDetails: (t: Train) => void;
  onIncident: (i: Incident) => void;
  query: string;
  setQuery: (s: string) => void;
  demo: boolean;
  showStations: boolean;
  onStation: (s: Stop) => void;
  loading: boolean;
  onClearSelection?: () => void;
  unlocatedCount?: number;
  onUnlocated?: () => void;
  onUnlocatedIncidents?: () => void;
}) {
  const [full, setFull] = useState(false);
  const stationMatches = query.trim()
    ? (demo ? stations : searchStations)
        .filter((s) => normalize(s.name).includes(normalize(query.trim())))
        .slice(0, 4)
    : [];
  const [layers, setLayers] = useState(false);
  const [visible, setVisible] = useState({
    trains: true,
    routes: false,
    stations: showStations,
    incidents: true,
  });
  const [base, setBase] = useLocalStorage<BaseMap>(
    "safel-map-base-v2",
    "street",
  );
  const [rail, setRail] = useLocalStorage<RailLayer>(
    "safel-map-rail-v2",
    "none",
  );
  const [follow, setFollow] = useState(false);
  const [railError, setRailError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [region, setRegion] = useState("all");
  const [command, setCommand] = useState({ name: "", count: 0 });
  const [geography, setGeography] = useState<FeatureCollection | null>(null);
  const [tileError, setTileError] = useState(false);
  const errorCount = useRef(0);
  const railErrors = useRef(0);
  useEffect(() => {
    errorCount.current = 0;
    setTileError(false);
  }, [base]);
  useEffect(() => {
    railErrors.current = 0;
    setRailError(false);
  }, [rail]);
  useEffect(() => {
    fetch("/geography.json")
      .then((r) => r.json())
      .then(setGeography)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setVisible((previous) => ({ ...previous, stations: showStations }));
  }, [showStations]);
  useEffect(() => {
    if (!full) return;
    document.body.classList.add("overflow-hidden");
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.classList.remove("overflow-hidden");
    };
  }, [full]);
  const send = (name: string) =>
    setCommand((c) => ({ name, count: c.count + 1 }));
  const content = (
    <section
      aria-label="Mapa de la red ferroviaria"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-line bg-white",
        full ? "fixed inset-3 z-[60] shadow-2xl" : "h-[540px] xl:h-[550px]",
      )}
    >
      <div className="flex h-[62px] shrink-0 items-center justify-between gap-2 border-b border-line px-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-[13px] font-bold">Mapa de la red</h2>
          <span className="hidden items-center gap-1.5 rounded bg-brand-50 px-2 py-1 text-[9px] font-medium text-brand-600 sm:inline-flex">
            <Dot />
            {demo ? "DEMOSTRACIÓN" : "DATOS PÚBLICOS"}
          </span>
        </div>
        <label className="flex items-center gap-1 text-[10px] text-muted">
          <MapPin size={12} />
          <select
            aria-label="Región del mapa"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="max-w-28 bg-transparent pr-1 text-[10px] text-ink"
          >
            <option value="all">Toda España</option>
            <option value="north">Zona norte</option>
            <option value="east">Zona este</option>
            <option value="center">Zona centro</option>
            <option value="south">Zona sur</option>
          </select>
        </label>
      </div>
      <div className="relative min-h-0 flex-1 bg-[#eaf0f1]">
        <MapContainer
          center={initialCenter}
          zoom={6}
          zoomSnap={0.25}
          minZoom={4}
          maxZoom={19}
          zoomControl={false}
          className="h-full w-full"
          attributionControl
        >
          {(base === "simple" || tileError) && geography && (
            <GeoJSON
              data={geography}
              attribution="Contornos: Natural Earth"
              style={{
                color: "#d4ddd6",
                weight: 1,
                fillColor: "#f3f5ef",
                fillOpacity: 1,
              }}
            />
          )}
          <RasterLayers
            base={base}
            rail={rail}
            baseError={tileError}
            railError={railError}
            attempt={attempt}
            onBaseError={() => {
              if (++errorCount.current > 5) setTileError(true);
            }}
            onRailError={() => {
              if (++railErrors.current >= 1) setRailError(true);
            }}
          />
          {visible.routes &&
            corridors.map((route, i) => (
              <Polyline
                key={i}
                positions={route}
                pathOptions={{
                  color: "#80b39a",
                  weight: 2,
                  opacity: 0.65,
                  dashArray: "4 3",
                }}
              >
                <Tooltip>Corredor orientativo · trazado esquemático</Tooltip>
              </Polyline>
            ))}
          {visible.stations &&
            stations
              .filter((_, i) => i !== 1)
              .map((s) => (
                <CircleMarker
                  key={s.id}
                  center={[s.lat, s.lon]}
                  radius={3.2}
                  pathOptions={{
                    color: "#7b9387",
                    weight: 1.2,
                    fillColor: "#fff",
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => onStation(s) }}
                >
                  <Tooltip
                    permanent={base === "simple" || tileError}
                    direction={s.lon > 0 ? "left" : "right"}
                    offset={[s.lon > 0 ? -5 : 5, 0]}
                    className={cn(
                      "station-label",
                      ![
                        "60000",
                        "71801",
                        "51003",
                        "03216",
                        "04040",
                        "13200",
                      ].includes(s.id) && "hidden sm:block",
                    )}
                  >
                    {s.name === "A Coruña"
                      ? s.name
                      : s.name.split(" · ")[0].split(" ")[0]}
                  </Tooltip>
                </CircleMarker>
              ))}
          {selected &&
            selected.routePoints &&
            selected.routePoints.length > 1 && (
              <Polyline
                positions={selected.routePoints}
                pathOptions={{
                  color: "#1d7953",
                  weight: 3,
                  opacity: 0.8,
                  dashArray: "7 6",
                }}
              >
                <Tooltip>
                  Itinerario entre puntos publicados por Renfe · no es una
                  geometría exacta de la vía
                </Tooltip>
              </Polyline>
            )}
          {visible.incidents &&
            incidents
              .filter((i) => i.lat && i.lon)
              .map((i) => (
                <Marker
                  key={i.id}
                  position={[i.lat!, i.lon!]}
                  title={i.title}
                  icon={alertIcon}
                  eventHandlers={{ click: () => onIncident(i) }}
                >
                  <Tooltip>
                    {i.title}
                    {demo ? " · ejemplo" : ""}
                  </Tooltip>
                </Marker>
              ))}
          {visible.trains && (
            <TrainMarkers
              trains={trains}
              selected={selected}
              onSelect={onSelect}
            />
          )}
          <MapController
            selected={selected}
            full={full}
            region={region}
            command={command}
            follow={follow}
          />
        </MapContainer>
        <div className="absolute left-4 right-16 top-4 z-10 max-w-[320px]">
          <div className="flex h-10 items-center gap-2.5 rounded-lg border border-white/90 bg-white px-3 shadow-[0_2px_8px_#173e310d]">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              aria-label="Buscar en el mapa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tren, estación o trayecto…"
              className="min-w-0 flex-1 bg-transparent text-[11px] placeholder:text-muted"
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X size={13} />
              </button>
            )}
            {!query && (
              <span className="rounded border border-line px-1 text-[9px] text-muted">
                ⌘ K
              </span>
            )}
          </div>
          {query && (
            <div className="mt-1 rounded-lg border border-line bg-white p-2 shadow-sm">
              <p className="px-2 py-1 text-[10px] text-muted">
                {trains.length}{" "}
                {trains.length === 1 ? "tren encontrado" : "trenes encontrados"}
              </p>
              {trains.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] hover:bg-brand-50"
                >
                  <TrainFront size={13} className="text-brand-600" />
                  <span>
                    {t.name} {t.number}
                    <span className="ml-2 text-muted">
                      {t.destination || t.nextStop || "Ver posición"}
                    </span>
                  </span>
                </button>
              ))}
              {stationMatches.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-2 text-[10px] text-muted">
                    Estaciones del catálogo
                  </p>
                  {stationMatches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onStation(s)}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] hover:bg-brand-50"
                    >
                      <MapPin size={13} className="text-brand-600" />
                      {s.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <MapLayersControl
          open={layers}
          setOpen={setLayers}
          base={base}
          setBase={setBase}
          rail={rail}
          setRail={setRail}
          visible={visible}
          setVisible={setVisible}
          baseError={tileError}
          railError={railError}
          retry={() => {
            errorCount.current = 0;
            railErrors.current = 0;
            setTileError(false);
            setRailError(false);
            setAttempt((a) => a + 1);
          }}
        />
        {(tileError || railError) && (
          <div className="absolute inset-x-4 top-16 z-10 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
            {tileError
              ? "Mapa base no disponible; se muestran contornos locales."
              : "La capa ferroviaria no está disponible. Esto no indica ausencia de vías."}
            <button
              aria-label="Reintentar cartografía"
              className="ml-2 inline-flex items-center gap-1 font-semibold"
              onClick={() => {
                errorCount.current = 0;
                railErrors.current = 0;
                setTileError(false);
                setRailError(false);
                setAttempt((a) => a + 1);
              }}
            >
              <RefreshCw size={11} />
              Reintentar
            </button>
          </div>
        )}
        {selected && !query && (
          <div
            className="absolute bottom-16 left-4 z-10 w-64 max-w-[calc(100%-5rem)] animate-enter rounded-xl border border-line bg-white p-3 shadow-md"
            aria-label="Resumen del tren seleccionado"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-left text-[11px] font-semibold text-brand-800">
                {selected.name} {selected.number}
                <span className="mt-1 block truncate text-[9px] font-normal text-muted">
                  {selected.origin || "Origen no publicado"} →{" "}
                  {selected.destination || "Destino no publicado"}
                </span>
              </div>
              <button
                aria-label="Quitar selección del mapa"
                onClick={() => {
                  setFollow(false);
                  onClearSelection?.();
                }}
              >
                <X size={13} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <SpeedValue train={selected} compact />
              <DelayBadge train={selected} />
            </div>
            <p
              className="mt-2 truncate text-[9px] text-muted"
              title={selected.nextStop}
            >
              Próxima: {selected.nextStop || "No publicada"}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setFollow(!follow)}
                aria-pressed={follow}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1.5 text-[9px]",
                  follow
                    ? "bg-brand-50 text-brand-700"
                    : "bg-canvas text-muted",
                )}
              >
                <Navigation size={11} />
                {follow ? "Cámara siguiendo" : "Seguir cámara"}
              </button>
              <button
                onClick={() => onDetails(selected)}
                className="rounded-md bg-brand-700 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-brand-800"
              >
                Ver detalles
              </button>
            </div>
            <p className="mt-2 text-[9px] text-muted">
              Posición {ageText(selected.timestamp, Date.now())}
            </p>
          </div>
        )}
        <div className="absolute bottom-11 right-4 z-10 flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-xs">
            <IconButton
              label="Acercar mapa"
              className="rounded-none"
              onClick={() => send("in")}
            >
              <Plus size={17} />
            </IconButton>
            <div className="mx-2 border-t border-line" />
            <IconButton
              label="Alejar mapa"
              className="rounded-none"
              onClick={() => send("out")}
            >
              <Minus size={17} />
            </IconButton>
          </div>
          <IconButton
            label="Centrar España"
            className="border border-line bg-white shadow-xs"
            onClick={() => send("reset")}
          >
            <Crosshair size={16} />
          </IconButton>
          <IconButton
            label={full ? "Salir de pantalla completa" : "Ampliar mapa"}
            className="border border-line bg-white shadow-xs"
            onClick={() => setFull(!full)}
          >
            {full ? <X size={16} /> : <Maximize2 size={15} />}
          </IconButton>
        </div>
        {!selected && (
          <div className="absolute bottom-12 left-4 z-10 max-w-[calc(100%-5rem)] rounded-lg border border-white bg-white/95 px-3 py-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand-500" />
                Tren localizado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-400" />
                Con demora
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-zinc-400" />
                Lectura antigua
              </span>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute bottom-1 left-4 z-10 text-[9px] text-zinc-500">
            Consultando fuentes públicas…
          </div>
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-line px-4 text-[9px] text-muted">
        <span className="flex items-center gap-1.5">
          <Dot className={demo ? "text-amber-500" : "text-brand-500"} />
          {demo
            ? "Posiciones simuladas"
            : `${trains.length} posiciones publicadas`}
        </span>
        <span>
          {base === "imagery"
            ? "Ortofoto de archivo · IGN/PNOA"
            : rail !== "none"
              ? `${railNames[rail]} · cartografía estática`
              : "OSM · cobertura parcial"}
        </span>
      </div>
      {(unlocatedCount > 0 ||
        incidents.some((i) => i.lat == null || i.lon == null)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/60 px-4 py-2 text-[9px] text-muted">
          {unlocatedCount > 0 && (
            <button
              onClick={onUnlocated}
              className="hover:text-brand-700 hover:underline"
            >
              {unlocatedCount} servicios sin coordenadas
            </button>
          )}
          {incidents.some((i) => i.lat == null || i.lon == null) && (
            <button
              onClick={onUnlocatedIncidents}
              className="text-amber-700 hover:underline"
            >
              {incidents.filter((i) => i.lat == null || i.lon == null).length}{" "}
              avisos sin ubicación verificable →
            </button>
          )}
        </div>
      )}
    </section>
  );
  return full ? createPortal(content, document.body) : content;
}
