import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe2,
  Info,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import type { Incident, Page, Stop, Train } from "./types";
import { cn, formatTime, matchesTrain } from "./lib/utils";
import { useNetwork } from "./hooks/useNetwork";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { MobileMenu, Sidebar } from "./components/Sidebar";
import { Stats } from "./components/Stats";
import { NetworkMap } from "./components/NetworkMap";
import {
  IncidentList,
  IncidentModal,
  IncidentPanel,
} from "./components/Incidents";
import { TrainTable } from "./components/TrainTable";
import { TrainDetail } from "./components/TrainDetail";
import { BrandMark } from "./components/BrandMark";
import { AccidentWatch } from "./components/AccidentWatch";
import { RailAccidentNews } from "./components/RailAccidentNews";
import { Advertising, AdvertisingPrivacy } from "./components/Advertising";
import { accidentEvidence } from "./lib/safety";
import { UnlocatedModal } from "./components/TrainTelemetry";
import {
  HelpModal,
  NotificationsModal,
  SavedPage,
  SettingsModal,
  SourcesPage,
  StationModal,
  StationsPage,
} from "./components/ExplorerPages";
import type { UpdateNotice } from "./components/ExplorerPages";
import { Badge, Button, Dot, ExternalLink, IconButton } from "./components/ui";

const pageDetails: Record<
  Page,
  { title: string; description: string; breadcrumb: string }
> = {
  map: {
    title: "La red, de un vistazo.",
    description:
      "Sigue los trenes, consulta los avisos y acompaña cada trayecto.",
    breadcrumb: "Vista general",
  },
  trains: {
    title: "Trenes y trayectos.",
    description:
      "Encuentra un servicio por su número, origen, destino o estación.",
    breadcrumb: "Trenes",
  },
  incidents: {
    title: "Avisos de la red.",
    description:
      "Boletines de Adif y avisos de Renfe, con procedencia y fechas conservadas.",
    breadcrumb: "Incidencias",
  },
  saved: {
    title: "Tus trayectos, más cerca.",
    description: "Los trayectos que sigues, reunidos en un mismo lugar.",
    breadcrumb: "Mis trayectos",
  },
  stations: {
    title: "Estaciones de la red.",
    description:
      "Consulta el catálogo de estaciones de Renfe, incluso sin trenes localizados en este momento.",
    breadcrumb: "Estaciones",
  },
  sources: {
    title: "Fuentes y cobertura.",
    description:
      "Fuentes públicas, fechas de actualización y límites de cobertura.",
    breadcrumb: "Fuentes y cobertura",
  },
  news: {
    title: "Noticias ferroviarias.",
    description: "Publicaciones recientes sobre la red ferroviaria española.",
    breadcrumb: "Noticias ferroviarias",
  },
};
function initialPage(): Page {
  const value = window.location.hash.slice(1);
  return Object.hasOwn(pageDetails, value) ? (value as Page) : "map";
}

function App() {
  const [page, setPageState] = useState<Page>(initialPage);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [unlocatedOpen, setUnlocatedOpen] = useState(false);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [station, setStation] = useState<Stop | null>(null);
  const [modal, setModal] = useState<
    "help" | "settings" | "notifications" | null
  >(null);
  const [toast, setToast] = useState("");
  const [autoRefresh, setAutoRefresh] = useLocalStorage(
    "safel-auto-refresh",
    true,
  );
  const [showStations, setShowStations] = useLocalStorage(
    "safel-stations",
    true,
  );
  const [savedModes, setSavedModes] = useLocalStorage<{
    live: string[];
    demo: string[];
  }>("safel-saved-v1", { live: [], demo: [] });
  const { data, loading, mode, setMode, error, refresh } =
    useNetwork(autoRefresh);
  const [now, setNow] = useState(new Date());
  const [notices, setNotices] = useState<UpdateNotice[]>([]);
  const lastDelays = useRef(new Map<string, number | null>());
  const seenAccidents = useRef<Map<string, string> | null>(null);
  const sharedApplied = useRef(false);
  const saved = savedModes[mode];
  const details = pageDetails[page];
  const trains = data?.trains || [];
  const incidents = data?.incidents || [];
  const sources = data?.sources || [];
  const selected = trains.find((t) => t.id === selectedId) || null;
  const mapSelected = trains.find((t) => t.id === focusedId) || null;
  const filteredTrains = useMemo(
    () => trains.filter((t) => matchesTrain(t, query)),
    [trains, query],
  );
  const notFresh = sources.filter((s) => s.status !== "ok");
  const currentCount = sources.filter((s) => s.status === "ok").length;
  const feedDate = sources
    .filter((s) => s.id.startsWith("positions") || s.id === "visor-ld")
    .reduce((n, s) => Math.max(n, s.timestamp || 0), 0);

  const setPage = (p: Page) => {
    setPageState(p);
    window.location.hash = p;
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const listener = () => setPageState(initialPage());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPage("map");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(
                '[aria-label="Buscar en el mapa"]',
              )
              ?.focus(),
          50,
        );
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.title = `Safel · ${details.breadcrumb}`;
  }, [details]);
  useEffect(() => {
    if (mode === "demo") {
      seenAccidents.current = null;
      return;
    }
    if (!data) return;
    const reports = data.incidents.filter(
      (i) => accidentEvidence(`${i.title}. ${i.description}`) === "reported",
    );
    if (!seenAccidents.current) {
      seenAccidents.current = new Map(
        reports.map((i) => [i.id, `${i.title}\n${i.description}`]),
      );
      return;
    }
    const updates: UpdateNotice[] = [];
    for (const report of reports) {
      const text = `${report.title}\n${report.description}`;
      if (seenAccidents.current.get(report.id) !== text)
        updates.push({
          id: `accident-${report.id}-${Date.now()}`,
          text: `Comunicado sobre accidente detectado o actualizado: ${report.title}. Confirma fecha, vigencia y ámbito en la fuente oficial; no implica un accidente ocurrido ahora.`,
          at: Math.floor(Date.now() / 1000),
        });
      seenAccidents.current.set(report.id, text);
    }
    if (updates.length) {
      setNotices((old) => [...updates, ...old].slice(0, 30));
      setToast(
        "Hay un comunicado sobre accidentes nuevo o actualizado. Revisa los avisos prioritarios.",
      );
    }
  }, [data, mode]);
  useEffect(() => {
    if (sharedApplied.current || loading || !data) return;
    sharedApplied.current = true;
    const number = new URLSearchParams(window.location.search).get("tren");
    if (!number) return;
    const train = data.trains.find((t) => t.number === number);
    if (train) {
      setFocusedId(train.id);
      setSelectedId(null);
      setPageState("map");
    } else {
      setPageState("trains");
      setQuery(number);
      setToast(
        `El tren ${number} no tiene una posición publicada en esta consulta.`,
      );
    }
  }, [data, loading]);
  useEffect(() => {
    if (mode === "demo" || !data || !autoRefresh) {
      lastDelays.current.clear();
      return;
    }
    const nextNotices: UpdateNotice[] = [];
    for (const train of data.trains.filter((t) => saved.includes(t.number))) {
      const previous = lastDelays.current.get(train.tripId);
      if (
        previous !== undefined &&
        train.delay !== null &&
        previous !== train.delay &&
        data.sources.find(
          (s) =>
            s.id ===
            (train.sourceId === "positions-cerc"
              ? "updates-cerc"
              : train.sourceId === "visor-ld"
                ? "visor-ld"
                : "updates-ld"),
        )?.status === "ok"
      )
        nextNotices.push({
          id: `${train.tripId}-${Date.now()}`,
          text: `${train.name} ${train.number}: la demora publicada ha cambiado de ${previous ?? "sin dato"} a ${train.delay} min.`,
          at: Math.floor(Date.now() / 1000),
        });
      lastDelays.current.set(train.tripId, train.delay);
    }
    if (nextNotices.length) {
      setNotices((old) => [...nextNotices, ...old].slice(0, 30));
      setToast("Hay una actualización en tus trayectos guardados.");
    }
  }, [data, saved, mode, autoRefresh]);

  function toggleSaved(train: Train) {
    const exists = saved.includes(train.number);
    setSavedModes((previous) => ({
      ...previous,
      [mode]: exists
        ? previous[mode].filter((n) => n !== train.number)
        : [...previous[mode], train.number],
    }));
    setToast(
      exists
        ? `Has dejado de seguir el tren ${train.number}.`
        : `Tren ${train.number} guardado en Mis trayectos.`,
    );
  }
  function changeMode(next: "live" | "demo") {
    setSelectedId(null);
    setFocusedId(null);
    setIncident(null);
    setStation(null);
    setQuery("");
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.delete("tren");
    if (next === "demo") url.searchParams.set("modo", "demo");
    else url.searchParams.delete("modo");
    window.history.replaceState({}, "", url);
  }
  const chooseTrain = (train: Train) => {
    setSelectedId(null);
    setFocusedId(train.id);
    setQuery("");
    if (page !== "map") setPage("map");
    else
      requestAnimationFrame(() =>
        document
          .querySelector('[aria-label="Mapa de la red ferroviaria"]')
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
  };
  const openTrainDetails = (train: Train) => setSelectedId(train.id);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded bg-brand-700 p-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <Sidebar
        page={page}
        setPage={setPage}
        incidentCount={incidents.length}
        savedCount={saved.length}
        open={menu}
        setOpen={setMenu}
        onHelp={() => setModal("help")}
        onSettings={() => setModal("settings")}
      />
      <div className="min-h-svh overflow-x-clip lg:ml-[218px]">
        <header className="flex h-[73px] items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-7 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <MobileMenu onClick={() => setMenu(true)} />
            <span className="hidden text-muted sm:inline">
              Centro de control
            </span>
            <ChevronRight size={12} className="hidden text-zinc-300 sm:block" />
            <span className="truncate font-medium">{details.breadcrumb}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-5">
            <div className="hidden items-center gap-2 text-[10px] text-zinc-500 md:flex">
              <Globe2 size={14} className="text-muted" />
              <span>Red ferroviaria española</span>
            </div>
            <div className="hidden h-5 border-l border-line sm:block" />
            <IconButton
              label="Buscar un tren"
              onClick={() => {
                setPage("map");
                setTimeout(
                  () =>
                    document
                      .querySelector<HTMLInputElement>(
                        '[aria-label="Buscar en el mapa"]',
                      )
                      ?.focus(),
                  50,
                );
              }}
            >
              <Search size={17} />
            </IconButton>
            <IconButton
              label="Centro de avisos"
              className="relative"
              onClick={() => setModal("notifications")}
            >
              <Bell size={17} />
              {notices.length > 0 && (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-500 ring-2 ring-white" />
              )}
            </IconButton>
            <button
              className="flex size-8 items-center justify-center rounded-xl transition-opacity hover:opacity-85"
              aria-label="Ayuda sobre Safel"
              onClick={() => setModal("help")}
            >
              <BrandMark className="size-8" />
            </button>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto max-w-[1680px] px-4 pb-5 pt-7 sm:px-7 xl:px-8"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[9px] font-medium tracking-[1.3px] text-muted">
                  TU VENTANA A LA RED
                </span>
                <span className="h-px w-6 bg-brand-200" />
              </div>
              <h1 className="font-display text-[25px] font-bold leading-tight tracking-[-1px] sm:text-[29px]">
                {details.title}
              </h1>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                {details.description}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="mr-1 hidden items-center gap-1.5 text-[10px] text-zinc-500 xl:flex">
                <CalendarDays size={13} />
                {now.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Europe/Madrid",
                })}
              </span>
              <div className="relative flex h-9 items-center rounded-lg border border-line bg-white">
                <span
                  className={cn(
                    "ml-3 size-1.5 rounded-full",
                    mode === "demo" ? "bg-amber-400" : "bg-brand-500",
                  )}
                />
                <select
                  aria-label="Modo de datos"
                  value={mode}
                  onChange={(e) =>
                    changeMode(e.target.value as "live" | "demo")
                  }
                  className="h-full appearance-none bg-transparent pl-2 pr-7 text-[10px] font-medium"
                >
                  <option value="live">Fuentes públicas</option>
                  <option value="demo">Demostración</option>
                </select>
                <ChevronDown
                  size={11}
                  className="pointer-events-none absolute right-2 text-muted"
                />
              </div>
              <Button
                aria-label="Actualizar datos"
                onClick={() => void refresh()}
                disabled={loading}
                className="px-2.5"
              >
                <RefreshCw
                  size={13}
                  className={loading ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            </div>
          </div>
          {mode === "demo" ? (
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-[10px] text-amber-800"
            >
              <span className="flex items-center gap-2">
                <Info size={13} />
                <span>
                  <strong className="font-semibold">Modo demostración.</strong>{" "}
                  Trenes, horarios y avisos simulados para explorar Safel.
                </span>
              </span>
              <button
                className="flex items-center gap-1.5 font-semibold hover:underline"
                onClick={() => changeMode("live")}
              >
                Conectar datos públicos
                <ArrowRight size={12} />
              </button>
            </div>
          ) : error ? (
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-[10px] text-amber-800"
            >
              <span className="flex items-center gap-2">
                <TriangleAlert size={15} />
                {error}
              </span>
              <button
                onClick={() => changeMode("demo")}
                className="font-semibold underline"
              >
                Explorar demostración
              </button>
            </div>
          ) : notFresh.length > 0 ? (
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 px-4 py-2.5 text-[10px] text-amber-800"
            >
              <span className="flex items-center gap-2">
                <Clock3 size={13} />
                Cobertura parcial: {notFresh.length}{" "}
                {notFresh.length === 1
                  ? "fuente sin actualización reciente"
                  : "fuentes sin actualización reciente o no disponibles"}
                . Comprueba las fechas de los datos.
              </span>
              <button
                onClick={() => setPage("sources")}
                className="flex items-center gap-1 font-semibold"
              >
                Ver fuentes
                <ArrowRight size={12} />
              </button>
            </div>
          ) : null}
          <AccidentWatch
            incidents={incidents}
            sources={sources}
            loading={loading && !data}
            failed={!!error}
            demo={mode === "demo"}
            onSelect={setIncident}
          />
          {page === "news" && (
            <RailAccidentNews
              items={data?.railNews || []}
              sources={sources}
              loading={loading && !data}
            />
          )}
          {page === "map" && (
            <div className="animate-enter space-y-5">
              <Stats data={data} loading={loading} />
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <Radio size={13} className="text-brand-600" />
                  <span className="text-[10px] font-medium">
                    Pulso de la red
                  </span>
                  <Badge
                    tone={
                      mode === "demo" || notFresh.length ? "amber" : "green"
                    }
                  >
                    <Dot />
                    {mode === "demo"
                      ? "Vista de ejemplo"
                      : loading
                        ? "Consultando fuentes"
                        : "Cobertura parcial"}
                  </Badge>
                </div>
                <span className="hidden items-center gap-1.5 text-[9px] text-muted sm:flex">
                  <Clock3 size={11} />
                  Última consulta {data ? formatTime(data.fetchedAt) : "…"}
                  <span className="mx-1">·</span>
                  {autoRefresh
                    ? "Actualización automática"
                    : "Actualización manual"}
                </span>
              </div>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_315px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <NetworkMap
                  trains={filteredTrains}
                  searchStations={data?.stations || []}
                  incidents={incidents}
                  selected={mapSelected}
                  onDetails={openTrainDetails}
                  onClearSelection={() => setFocusedId(null)}
                  unlocatedCount={data?.unlocatedTrains?.length || 0}
                  onUnlocated={() => setUnlocatedOpen(true)}
                  onUnlocatedIncidents={() => setPage("incidents")}
                  onSelect={chooseTrain}
                  onIncident={setIncident}
                  query={query}
                  setQuery={setQuery}
                  demo={mode === "demo"}
                  showStations={showStations}
                  onStation={setStation}
                  loading={loading}
                />
                <IncidentPanel
                  incidents={incidents}
                  sources={sources}
                  demo={mode === "demo"}
                  onSelect={setIncident}
                  onViewAll={() => setPage("incidents")}
                />
              </div>
              <TrainTable
                trains={filteredTrains}
                demo={mode === "demo"}
                saved={saved}
                onSave={toggleSaved}
                onSelect={chooseTrain}
                compact
                onViewAll={() => setPage("trains")}
              />
            </div>
          )}
          {page === "trains" && (
            <div className="animate-enter space-y-5">
              <Stats data={data} loading={loading} />
              <TrainTable
                trains={trains}
                externalQuery={query}
                demo={mode === "demo"}
                saved={saved}
                onSave={toggleSaved}
                onSelect={chooseTrain}
              />
            </div>
          )}
          {page === "incidents" && (
            <div className="animate-enter space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <TriangleAlert size={18} className="text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold">
                      {incidents.length} avisos en la respuesta de la fuente
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      Incluye boletines públicos de tráfico y obras de Adif. Los
                      reportes internos de maquinistas no son una fuente
                      integrada.
                    </p>
                  </div>
                </div>
                <ExternalLink
                  href="https://www.adif.es/viajeros/estado-de-la-red"
                  className="text-[10px]"
                >
                  Estado oficial · Adif
                </ExternalLink>
              </div>
              <IncidentList incidents={incidents} onSelect={setIncident} />
            </div>
          )}
          {page === "saved" && (
            <SavedPage
              trains={trains}
              saved={saved}
              demo={mode === "demo"}
              onSave={toggleSaved}
              onSelect={chooseTrain}
              onExplore={() => setPage("trains")}
              onRemove={(number) =>
                setSavedModes((p) => ({
                  ...p,
                  [mode]: p[mode].filter((n) => n !== number),
                }))
              }
            />
          )}
          {page === "stations" && (
            <StationsPage
              trains={trains}
              catalogStations={data?.stations || []}
              demo={mode === "demo"}
              onSelect={setStation}
            />
          )}
          {page === "sources" && <SourcesPage data={data} />}
          <Advertising />
          <div className="mt-6 flex flex-col justify-between gap-3 rounded-lg border border-brand-100/60 bg-brand-50/50 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                size={16}
                className="mt-.5 shrink-0 text-brand-600"
              />
              <p className="max-w-3xl text-[9px] leading-5 text-zinc-500">
                <strong className="font-medium text-brand-800">
                  Información para acompañarte.
                </strong>{" "}
                Safel muestra datos públicos con cobertura parcial. La ausencia
                de avisos no garantiza la seguridad de un trayecto.
              </p>
            </div>
            <button
              onClick={() => setPage("sources")}
              className="flex shrink-0 items-center gap-1 text-[9px] font-medium text-brand-700"
            >
              Conoce la cobertura
              <ArrowRight size={11} />
            </button>
          </div>
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[9px] text-muted">
            <p>
              Safel <span className="mx-1">© {now.getFullYear()}</span> · Un
              proyecto independiente.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <AdvertisingPrivacy />
              <ExternalLink
                href="https://data.renfe.com/"
                className="text-muted"
              >
                Renfe Open Data
              </ExternalLink>
              <ExternalLink
                href="https://www.adif.es/viajeros/estado-de-la-red"
                className="text-muted"
              >
                Adif
              </ExternalLink>
              <button
                onClick={() => setModal("help")}
                className="flex items-center gap-1.5 hover:text-brand-700"
              >
                <CircleHelp size={11} />
                Ayuda
              </button>
              <span className="flex items-center gap-1.5">
                <Dot
                  className={
                    mode === "demo" ? "text-amber-500" : "text-brand-500"
                  }
                />
                {mode === "demo"
                  ? "Demo"
                  : `${currentCount}/${sources.length || "…"} fuentes disponibles`}
              </span>
            </div>
          </footer>
          {feedDate > 0 && mode === "live" && (
            <p className="mt-2 text-right text-[8px] text-muted">
              Fecha más reciente entre los feeds de posiciones:{" "}
              {formatTime(feedDate, true)}
            </p>
          )}
        </main>
      </div>
      {selected && (
        <TrainDetail
          train={selected}
          incidents={incidents}
          source={sources.find((s) => s.id === selected.sourceId)}
          demo={mode === "demo"}
          saved={saved.includes(selected.number)}
          onSave={toggleSaved}
          onLocate={() => {
            setFocusedId(selected.id);
            setSelectedId(null);
            setPage("map");
          }}
          onClose={() => setSelectedId(null)}
          onIncident={setIncident}
        />
      )}
      {incident && (
        <IncidentModal
          incident={incident}
          demo={mode === "demo"}
          source={sources.find((s) => s.id === incident.sourceId)}
          onClose={() => setIncident(null)}
        />
      )}
      {station && (
        <StationModal
          station={station}
          trains={trains}
          onSelect={chooseTrain}
          onClose={() => setStation(null)}
        />
      )}
      {unlocatedOpen && (
        <UnlocatedModal
          trains={data?.unlocatedTrains || []}
          onClose={() => setUnlocatedOpen(false)}
        />
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "settings" && (
        <SettingsModal
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          showStations={showStations}
          setShowStations={setShowStations}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "notifications" && (
        <NotificationsModal
          notices={notices}
          savedCount={saved.length}
          onClose={() => setModal(null)}
        />
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[80] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 animate-enter items-center gap-3 rounded-xl border border-brand-200 bg-white px-5 py-3.5 text-xs shadow-lg"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Check size={13} />
          </span>
          {toast}
          <IconButton
            label="Cerrar notificación"
            className="size-6"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </IconButton>
        </div>
      )}
      <Analytics />
    </>
  );
}
export default App;
