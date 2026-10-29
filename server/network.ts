import { unzipSync, strFromU8 } from "fflate";
import {
  fetchVisor,
  fetchVisorAuxiliary,
  normalizeVisor,
  stationsFromVisor,
} from "./visor.ts";
import { fetchAdif, incidentCategory } from "./adif.ts";
import { MotionHistory } from "./telemetry.ts";
import { prioritizeIncidents } from "../src/lib/safety.ts";
import type {
  Category,
  DataSource,
  Incident,
  NetworkData,
  Service,
  Stop,
  Train,
  UnlocatedTrain,
} from "../src/types.ts";

type JsonObject = Record<string, any>;
interface FeedResult {
  data: JsonObject | null;
  source: DataSource;
}
export interface Schedule {
  trips: Map<string, JsonObject>;
  routes: Map<string, JsonObject>;
  stops: Map<string, Stop>;
  stopTimes: Map<string, (Stop & { sequence?: number })[]>;
}
const feedDefinitions = [
  {
    id: "positions-ld",
    name: "Posiciones · AV / LD / MD",
    url: "https://gtfsrt.renfe.com/vehicle_positions_LD.json",
    cadence: "15 min",
    maxAge: 1200,
    scope:
      "Trenes Renfe de alta velocidad, larga y media distancia. No incluye todos los operadores.",
  },
  {
    id: "positions-cerc",
    name: "Posiciones · Cercanías",
    url: "https://gtfsrt.renfe.com/vehicle_positions.json",
    cadence: "20 s",
    maxAge: 120,
    scope: "Servicios de Cercanías con coordenadas publicadas por Renfe.",
  },
  {
    id: "updates-ld",
    name: "Horarios · AV / LD / MD",
    url: "https://gtfsrt.renfe.com/trip_updates_LD.json",
    cadence: "30 s",
    maxAge: 120,
    scope:
      "Actualizaciones de viaje y retrasos de Renfe. Solo se cruzan identificadores de viaje exactos.",
  },
  {
    id: "updates-cerc",
    name: "Horarios · Cercanías",
    url: "https://gtfsrt.renfe.com/trip_updates.json",
    cadence: "30 s",
    maxAge: 120,
    scope: "Actualizaciones de viaje del servicio de Cercanías.",
  },
  {
    id: "alerts",
    name: "Avisos · Cercanías",
    url: "https://gtfsrt.renfe.com/alerts.json",
    cadence: "20 s",
    maxAge: 180,
    scope:
      "Avisos publicados para Cercanías. No es un registro completo de accidentes ni del estado técnico de la red.",
  },
];
const lastFeeds = new Map<string, FeedResult>();
let schedule: Schedule | null = null;
let scheduleAt = 0;
let scheduleAttemptAt = 0;
let scheduleError = "";
let resultCache: NetworkData | null = null;
let inFlight: Promise<NetworkData> | null = null;
const motionHistory = new MotionHistory();
const number = (value: unknown): number | null =>
  value === undefined ||
  value === null ||
  value === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
const field = (
  object: JsonObject | null | undefined,
  camel: string,
  snake: string,
) => object?.[camel] ?? object?.[snake];

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((x) =>
    x.replace(/^\uFEFF/, "").trim(),
  );
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])),
  );
}

async function loadSchedule(): Promise<Schedule | null> {
  const now = Date.now();
  if (schedule && now - scheduleAt < 12 * 60 * 60 * 1000) return schedule;
  if (now - scheduleAttemptAt < 5 * 60 * 1000) return schedule;
  scheduleAttemptAt = now;
  try {
    const response = await fetch(
      "https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip",
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()), {
      filter: (f) => /(^|\/)(trips|routes|stops|stop_times)\.txt$/.test(f.name),
    });
    const read = (name: string) => {
      const key = Object.keys(files).find((k) => k.endsWith(name));
      return key ? parseCsv(strFromU8(files[key])) : [];
    };
    const trips = new Map(read("trips.txt").map((t) => [t.trip_id, t]));
    const routes = new Map(read("routes.txt").map((r) => [r.route_id, r]));
    const stops = new Map<string, Stop>(
      read("stops.txt").map((s) => [
        s.stop_id,
        {
          id: s.stop_id,
          name: s.stop_name,
          lat: Number(s.stop_lat),
          lon: Number(s.stop_lon),
        },
      ]),
    );
    const stopTimes: Schedule["stopTimes"] = new Map();
    for (const s of read("stop_times.txt")) {
      const stop = stops.get(s.stop_id);
      if (!stop) continue;
      const entry = {
        ...stop,
        arrival: s.arrival_time,
        departure: s.departure_time,
        sequence: Number(s.stop_sequence),
      };
      const existing = stopTimes.get(s.trip_id);
      if (existing) existing.push(entry);
      else stopTimes.set(s.trip_id, [entry]);
    }
    for (const stops of stopTimes.values())
      stops.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    if (!trips.size || !stops.size) throw new Error("Catálogo GTFS incompleto");
    schedule = { trips, routes, stops, stopTimes };
    scheduleAt = now;
    scheduleError = "";
  } catch {
    scheduleError =
      "El catálogo de horarios no está disponible. Algunos trayectos y estaciones pueden no resolverse.";
  }
  return schedule;
}

async function fetchFeed(
  def: (typeof feedDefinitions)[number],
): Promise<FeedResult> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(def.url, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as JsonObject;
    if (!Array.isArray(data.entity) && !data.header)
      throw new Error("Formato inesperado");
    const timestamp = number(data.header?.timestamp);
    const status =
      !timestamp || now - timestamp > def.maxAge || timestamp - now > 300
        ? "stale"
        : "ok";
    const result: FeedResult = {
      data,
      source: {
        id: def.id,
        name: def.name,
        url: def.url,
        cadence: def.cadence,
        scope: def.scope,
        status,
        timestamp,
        fetchedAt: now,
      },
    };
    lastFeeds.set(def.id, result);
    return result;
  } catch {
    const previous = lastFeeds.get(def.id);
    return {
      data: previous?.data || null,
      source: {
        id: def.id,
        name: def.name,
        url: def.url,
        cadence: def.cadence,
        scope: def.scope,
        status: previous?.data ? "stale" : "unavailable",
        timestamp: previous?.source.timestamp || null,
        fetchedAt: previous?.source.fetchedAt || null,
        error: previous
          ? "La última consulta ha fallado. Se conserva la última respuesta con su fecha original."
          : "No se ha podido consultar la fuente.",
      },
    };
  }
}

export function normalizeTrains(
  positions: JsonObject,
  updates: JsonObject | null,
  sourceId: string,
  catalog: Schedule | null,
): Train[] {
  const updateMap = new Map<string, JsonObject>();
  for (const entity of updates?.entity || []) {
    const update = field(entity, "tripUpdate", "trip_update");
    const id = field(update?.trip, "tripId", "trip_id");
    if (id) updateMap.set(id, update);
  }
  const result: Train[] = [];
  for (const entity of positions.entity || []) {
    const v = entity.vehicle;
    if (!v) continue;
    const lat = number(v.position?.latitude);
    const lon = number(v.position?.longitude);
    if (
      lat === null ||
      lon === null ||
      lat < 27 ||
      lat > 47 ||
      lon < -19 ||
      lon > 5
    )
      continue;
    const tripId = field(v.trip, "tripId", "trip_id") || entity.id;
    const id = `${sourceId}-${tripId}`;
    const trip = catalog?.trips.get(tripId);
    const route = trip ? catalog?.routes.get(trip.route_id) : null;
    const stopList = catalog?.stopTimes.get(tripId) || [];
    const stopId = field(v, "stopId", "stop_id");
    const update = updateMap.get(tripId);
    const stopUpdates =
      field(update, "stopTimeUpdate", "stop_time_update") || [];
    const matchingStop = stopUpdates.find(
      (s: JsonObject) => field(s, "stopId", "stop_id") === stopId,
    );
    const delaySeconds =
      number(update?.delay) ??
      number(matchingStop?.arrival?.delay) ??
      number(matchingStop?.departure?.delay);
    const label: string = v.vehicle?.label || v.vehicle?.id || entity.id;
    const name: string =
      route?.route_short_name ||
      (sourceId === "positions-cerc" ? label.split("-")[0] : "Renfe");
    const service: Service =
      sourceId === "positions-cerc"
        ? "Cercanías"
        : /AVE|AVLO/i.test(name)
          ? "Alta velocidad"
          : /AVANT|MD|REGIONAL|PROXIMIDAD/i.test(name)
            ? "Media distancia"
            : route
              ? "Larga distancia"
              : "Sin clasificar";
    result.push({
      id,
      number: String(v.vehicle?.id || label),
      name,
      service,
      tripId,
      routeId: trip?.route_id || field(v.trip, "routeId", "route_id"),
      origin: stopList[0]?.name,
      destination: stopList.at(-1)?.name,
      lat,
      lon,
      delay: delaySeconds === null ? null : Math.round(delaySeconds / 60),
      status: field(v, "currentStatus", "current_status") || "UNKNOWN",
      timestamp: number(v.timestamp) ?? number(positions.header?.timestamp),
      nextStopId: stopId,
      nextStop:
        catalog?.stops.get(stopId)?.name ||
        (stopId && stopId !== "00000" ? `Estación ${stopId}` : undefined),
      stops: stopList,
      sourceId,
      canceled:
        field(update?.trip, "scheduleRelationship", "schedule_relationship") ===
        "CANCELED",
    });
  }
  const delayTimestamp = number(updates?.header?.timestamp);
  const now = Math.floor(Date.now() / 1000);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const unique = new Map<string, Train>();
  const rank = (t: Train) => {
    const date = t.tripId.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return (
      (date === today ? 1000 : date && date > today ? -1000 : 0) +
      (t.stops.length ? 10 : 0) +
      (t.timestamp || 0) / 1e10
    );
  };
  for (const train of result) {
    const raw = (positions.entity || []).find(
      (e: JsonObject) =>
        (field(e.vehicle?.trip, "tripId", "trip_id") || e.id) === train.tripId,
    )?.vehicle;
    const speed = number(raw?.position?.speed);
    const bearing = number(raw?.position?.bearing);
    train.speedKmh =
      speed !== null && speed >= 0 && speed <= 125 ? speed * 3.6 : null;
    train.speedKind = train.speedKmh === null ? "unavailable" : "reported";
    train.bearing =
      bearing !== null && bearing >= 0 && bearing <= 360 ? bearing % 360 : null;
    train.bearingKind = train.bearing === null ? "unavailable" : "reported";
    train.positionTimestampKind =
      number(raw?.timestamp) !== null
        ? "vehicle"
        : number(positions.header?.timestamp) !== null
          ? "feed"
          : "unknown";
    train.platform = raw?.vehicle?.label?.match(/PLATF\.\(([^)]+)\)/)?.[1];
    train.stopSequence = number(
      field(raw, "currentStopSequence", "current_stop_sequence"),
    );
    train.occupancy = field(raw, "occupancyStatus", "occupancy_status");
    const odometer = number(raw?.position?.odometer);
    train.odometerKm = odometer === null ? null : odometer / 1000;
    train.delayTimestamp = delayTimestamp;
    train.delayStale =
      !delayTimestamp ||
      now - delayTimestamp > 120 ||
      delayTimestamp - now > 300;
    const previous = unique.get(train.number);
    // Split/combined services may publish multiple trip IDs for the same vehicle number.
    // Retain the current service date when present; never join delays by vehicle number.
    if (!previous || rank(train) > rank(previous))
      unique.set(train.number, train);
  }
  return [...unique.values()];
}

const translation = (value: JsonObject) =>
  value?.translation?.find((t: JsonObject) => t.language === "es")?.text ||
  value?.translation?.[0]?.text ||
  "";
export function normalizeAlerts(
  feed: JsonObject,
  catalog: Schedule | null,
  now = Math.floor(Date.now() / 1000),
): Incident[] {
  return (feed.entity || []).flatMap((entity: JsonObject) => {
    const alert = entity.alert;
    if (!alert) return [];
    const periods = field(alert, "activePeriod", "active_period") || [];
    // Do not call open-ended old notices resolved or current: freshness is a separate source property.
    if (
      periods.length &&
      periods.every((p: JsonObject) => p.end && Number(p.end) < now)
    )
      return [];
    const description: string = translation(
      field(alert, "descriptionText", "description_text"),
    );
    const header = translation(field(alert, "headerText", "header_text"));
    if (!description && !header) return [];
    const category: Category = incidentCategory(description);
    const entities = field(alert, "informedEntity", "informed_entity") || [];
    const routeIds = entities
      .map((e: JsonObject) => field(e, "routeId", "route_id"))
      .filter(Boolean);
    const stopIds = entities
      .map((e: JsonObject) => field(e, "stopId", "stop_id"))
      .filter(Boolean);
    const stop = catalog?.stops.get(stopIds[0]);
    const effect = alert.effect;
    // Severity is assigned only from explicit GTFS effect, never guessed from alarming words.
    const severity =
      effect === "NO_SERVICE" || effect === 1
        ? "high"
        : effect === "SIGNIFICANT_DELAYS" || effect === 3
          ? "medium"
          : "info";
    return [
      {
        id: entity.id,
        title:
          header ||
          (category === "Accesibilidad"
            ? "Aviso de accesibilidad"
            : category === "Obras"
              ? "Obras y mantenimiento"
              : `Aviso de ${category.toLowerCase()}`),
        description,
        category,
        severity,
        location:
          stop?.name ||
          description
            .match(/#[\wÀ-ÿ-]+/g)
            ?.slice(0, 3)
            .join(" · ") ||
          "Red de Cercanías",
        start: number(periods[0]?.start),
        end: number(periods[0]?.end),
        sourceId: "alerts",
        sourceName: "Renfe",
        cause: alert.cause,
        effect: alert.effect,
        url: "https://data.renfe.com/dataset/incidencias-avisos",
        routeIds,
        stopIds,
        ...(stop ? { lat: stop.lat, lon: stop.lon } : {}),
      },
    ];
  });
}

export async function getNetwork(): Promise<NetworkData> {
  if (resultCache && Date.now() / 1000 - resultCache.fetchedAt < 20)
    return resultCache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [feeds, originalCatalog, fleet, auxiliary, adif] = await Promise.all([
      Promise.all(feedDefinitions.map(fetchFeed)),
      loadSchedule(),
      fetchVisor(),
      fetchVisorAuxiliary(),
      fetchAdif(),
    ]);
    const extraStops = stationsFromVisor(
      auxiliary.find((a) => a.source.id === "visor-stations")?.data || null,
    );
    const catalog =
      originalCatalog ||
      (extraStops.length
        ? ({
            trips: new Map(),
            routes: new Map(),
            stops: new Map<string, Stop>(),
            stopTimes: new Map(),
          } as Schedule)
        : null);
    for (const stop of extraStops)
      if (!catalog?.stops.has(stop.id)) catalog?.stops.set(stop.id, stop);
    const get = (id: string) =>
      feeds.find((f) => f.source.id === id)?.data || null;
    const gtfsTrains = ["positions-ld", "positions-cerc"].flatMap((id) => {
      const positions = get(id);
      const updateId = id === "positions-ld" ? "updates-ld" : "updates-cerc";
      const normalized = positions
        ? normalizeTrains(positions, get(updateId), id, catalog)
        : [];
      if (feeds.find((f) => f.source.id === updateId)?.source.status !== "ok")
        normalized.forEach((t) => {
          t.delayStale = true;
        });
      return normalized;
    });
    const visor = fleet.data
      ? normalizeVisor(
          fleet.data,
          catalog,
          get("updates-ld"),
          auxiliary.find((a) => a.source.id === "visor-routes")?.data || null,
        )
      : { trains: [], unlocatedTrains: [] };
    const ld = new Map(
      gtfsTrains
        .filter((t) => t.sourceId === "positions-ld")
        .map((t) => [t.number, { ...t, id: `renfe-ld-${t.number}` }]),
    );
    for (const train of visor.trains) {
      const old = ld.get(train.number);
      if (!old || (train.timestamp || 0) > (old.timestamp || 0))
        ld.set(train.number, train);
    }
    const trains = motionHistory.apply([
      ...ld.values(),
      ...gtfsTrains.filter((t) => t.sourceId !== "positions-ld"),
    ]);
    if (fleet.source.status !== "ok")
      trains
        .filter((t) => t.sourceId === "visor-ld")
        .forEach((t) => {
          t.positionStale = true;
          t.delayStale = true;
          if (t.speedKind === "estimated") {
            t.speedKmh = null;
            t.speedKind = "unavailable";
          }
        });
    const alerts = get("alerts");
    const sources = feeds.map((f) => f.source);
    sources.push({
      id: "schedule",
      name: "Catálogo de horarios GTFS",
      url: "https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia",
      status: originalCatalog
        ? scheduleError
          ? "stale"
          : "ok"
        : "unavailable",
      timestamp: null,
      fetchedAt: originalCatalog ? Math.floor(scheduleAt / 1000) : null,
      cadence: "Consulta cada 12 h",
      scope:
        "Horarios programados y estaciones de AV, LD y MD. La hora de descarga no indica la fecha de edición.",
      ...(scheduleError ? { error: scheduleError } : {}),
    });
    sources.push(
      fleet.source,
      ...auxiliary.map((a) => a.source),
      ...adif.map((a) => a.source),
    );
    const unlocatedCerc: UnlocatedTrain[] = (
      get("positions-cerc")?.entity || []
    ).flatMap((e: JsonObject) => {
      const v = e.vehicle;
      if (
        !v ||
        (number(v.position?.latitude) !== null &&
          number(v.position?.longitude) !== null)
      )
        return [];
      const id = v.vehicle?.id;
      return id
        ? [
            {
              number: String(id),
              name: String(v.vehicle?.label || "Cercanías").split("-")[0],
              sourceId: "positions-cerc",
            },
          ]
        : [];
    });
    resultCache = {
      trains,
      stations: [...(catalog?.stops.values() || [])].filter(
        (s) => Number.isFinite(s.lat) && Number.isFinite(s.lon),
      ),
      incidents: prioritizeIncidents([
        ...adif.flatMap((a) => a.incidents),
        ...(alerts ? normalizeAlerts(alerts, catalog) : []),
      ]),
      sources,
      unlocatedTrains: [
        ...new Map(
          [...visor.unlocatedTrains, ...unlocatedCerc]
            .filter(
              (t) =>
                !trains.some(
                  (p) =>
                    p.number === t.number &&
                    (p.sourceId === t.sourceId ||
                      (t.sourceId === "visor-ld" &&
                        p.sourceId === "positions-ld")),
                ),
            )
            .map((t) => [`${t.sourceId}:${t.number}`, t]),
        ).values(),
      ],
      fetchedAt: Math.floor(Date.now() / 1000),
      demo: false,
    };
    return resultCache;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
