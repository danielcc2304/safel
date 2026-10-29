import type { DataSource, Train, UnlocatedTrain } from "../src/types.ts";
import type { Schedule } from "./network.ts";
import { finite, madridDate, parseMadridDate } from "./telemetry.ts";
import type { Stop, Service } from "../src/types.ts";

type RecordData = Record<string, any>;
export const visorUrl =
  "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json";
export const routeUrl =
  "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json";
const stationUrl =
  "https://tiempo-real.largorecorrido.renfe.com/data/estaciones.geojson";
// Product labels verified in Renfe's public visor, js/main.bundle.js (29 October 2026).
const products: Record<number, [string, Service]> = {
  2: ["Alta Velocidad", "Alta velocidad"],
  3: ["Avant", "Media distancia"],
  4: ["Talgo", "Larga distancia"],
  5: ["Altaria", "Larga distancia"],
  7: ["Diurno", "Larga distancia"],
  8: ["Estrella", "Larga distancia"],
  9: ["Tren Hotel", "Larga distancia"],
  10: ["Euromed", "Larga distancia"],
  11: ["Alvia", "Larga distancia"],
  13: ["Intercity", "Larga distancia"],
  14: ["Andalucía Express", "Media distancia"],
  15: ["Catalunya Express", "Media distancia"],
  16: ["Media Distancia", "Media distancia"],
  18: ["Regional", "Media distancia"],
  19: ["Regional Express", "Media distancia"],
  20: ["TRD", "Media distancia"],
  21: ["Cercanías", "Cercanías"],
  24: ["AV City", "Larga distancia"],
  25: ["AVE TGV", "Alta velocidad"],
  28: ["Avlo", "Alta velocidad"],
};
const auxiliary = new Map<
  string,
  { data: RecordData | null; source: DataSource; attemptedAt: number }
>();
export async function fetchVisorAuxiliary() {
  const now = Math.floor(Date.now() / 1000);
  return Promise.all(
    [
      {
        id: "visor-routes",
        name: "Renfe · itinerarios del visor",
        url: routeUrl,
        ttl: 60,
        scope:
          "Paradas, horas programadas y puntos del itinerario. La unión de puntos no es una geometría exacta de la vía.",
      },
      {
        id: "visor-stations",
        name: "Renfe · estaciones del visor",
        url: stationUrl,
        ttl: 43200,
        scope:
          "Nombres, códigos y coordenadas de referencia de estaciones. Catálogo estático, no estado técnico.",
      },
    ].map(async (def) => {
      const old = auxiliary.get(def.id);
      if (old && now - old.attemptedAt < def.ttl) return old;
      const base = {
        id: def.id,
        name: def.name,
        url: def.url,
        cadence: def.ttl === 60 ? "Consulta cada min" : "Consulta cada 12 h",
        scope: def.scope,
      };
      try {
        const response = await fetch(def.url, {
          signal: AbortSignal.timeout(9000),
        });
        if (!response.ok) throw new Error("Fuente no disponible");
        const data = (await response.json()) as RecordData;
        if (
          !(def.id === "visor-routes"
            ? Array.isArray(data.trenes)
            : Array.isArray(data.features))
        )
          throw new Error("Formato cambiado");
        const timestamp =
          def.id === "visor-routes"
            ? parseMadridDate(data.fechaActualizacion)
            : null;
        const result = {
          data,
          source: {
            ...base,
            status:
              def.id === "visor-routes" &&
              (!timestamp || now - timestamp > 300 || timestamp - now > 30)
                ? "stale"
                : "ok",
            timestamp,
            fetchedAt: now,
          } as DataSource,
          attemptedAt: now,
        };
        auxiliary.set(def.id, result);
        return result;
      } catch {
        const result = {
          data: old?.data || null,
          source: {
            ...base,
            status: old?.data ? "stale" : "unavailable",
            timestamp: old?.source.timestamp || null,
            fetchedAt: old?.source.fetchedAt || null,
            error: "No se ha podido actualizar el recurso público del visor.",
          } as DataSource,
          attemptedAt: now - def.ttl + 300,
        };
        auxiliary.set(def.id, result);
        return result;
      }
    }),
  );
}
export function stationsFromVisor(data: RecordData | null): Stop[] {
  return (data?.features || []).flatMap((f: RecordData) => {
    const p = f.properties;
    const lat = finite(f.geometry?.coordinates?.[1]);
    const lon = finite(f.geometry?.coordinates?.[0]);
    if (!p?.CODIGO || !p.NOMBRE || lat === null || lon === null) return [];
    return [
      {
        id: String(p.CODIGO).padStart(5, "0"),
        name: String(p.NOMBRE),
        lat,
        lon,
      },
    ];
  });
}
let previous: {
  data: RecordData;
  fetchedAt: number;
  timestamp: number | null;
} | null = null;
export async function fetchVisor() {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    id: "visor-ld",
    name: "Visor Renfe · larga distancia",
    url: visorUrl,
    cadence: "Consulta cada 20 s; cadencia del publicador no garantizada",
    scope:
      "Posición con hora propia del vehículo, origen, destino, siguiente parada, demora, material y accesibilidad cuando están publicados. No es una API contractual.",
  };
  try {
    const response = await fetch(visorUrl, {
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("Visor no disponible");
    const data = (await response.json()) as RecordData;
    if (!Array.isArray(data.trenes))
      throw new Error("Formato del visor cambiado");
    const timestamp = parseMadridDate(data.fechaActualizacion);
    previous = { data, fetchedAt: now, timestamp };
    return {
      data,
      source: {
        ...base,
        timestamp,
        fetchedAt: now,
        status:
          timestamp && now - timestamp <= 120 && timestamp - now <= 30
            ? "ok"
            : "stale",
      } as DataSource,
    };
  } catch {
    return {
      data: previous?.data || null,
      source: {
        ...base,
        timestamp: previous?.timestamp || null,
        fetchedAt: previous?.fetchedAt || null,
        status: previous ? "stale" : "unavailable",
        error:
          "El visor no ha respondido. Se conservan fechas originales si existe una consulta anterior.",
      } as DataSource,
    };
  }
}
export function normalizeVisor(
  data: RecordData,
  catalog: Schedule | null,
  updates: RecordData | null,
  itineraries: RecordData | null = null,
) {
  const updatesByTrip = new Map(
    (updates?.entity || []).map((e: RecordData) => {
      const u = e.tripUpdate || e.trip_update;
      return [u?.trip?.tripId || u?.trip?.trip_id, u];
    }),
  );
  const tripsByNumber = new Map<string, RecordData[]>();
  for (const trip of catalog?.trips.values() || []) {
    if (!trip.trip_short_name) continue;
    const key = trip.trip_short_name.padStart(5, "0");
    const group = tripsByNumber.get(key);
    if (group) group.push(trip);
    else tripsByNumber.set(key, [trip]);
  }
  const nameFor = (code: unknown) => catalog?.stops.get(String(code))?.name;
  const itineraryDate = parseMadridDate(itineraries?.fechaActualizacion);
  const itineraryMap = new Map<string, RecordData>(
    (itineraries?.trenes || []).map((t: RecordData) => [
      String(t.idTren).padStart(5, "0"),
      t,
    ]),
  );
  const seen = new Map<string, Train>();
  for (const v of data.trenes || []) {
    const lat = finite(v.latitud);
    const lon = finite(v.longitud);
    if (
      lat === null ||
      lon === null ||
      lat < 27 ||
      lat > 47 ||
      lon < -19 ||
      lon > 5
    )
      continue;
    const number = String(v.codComercial || "").padStart(5, "0");
    if (!v.codComercial) continue;
    const timestamp = finite(v.time);
    const serviceDate = timestamp ? madridDate(timestamp) : null;
    const candidates = (tripsByNumber.get(number) || []).filter((t) => {
      if (!serviceDate || !t.trip_id.endsWith(serviceDate)) return false;
      const stops = catalog?.stopTimes.get(t.trip_id) || [];
      return (
        stops[0]?.id === String(v.codOrigen) &&
        stops.at(-1)?.id === String(v.codDestino)
      );
    });
    const trip = candidates.length === 1 ? candidates[0] : undefined;
    const itinerary =
      itineraryDate && serviceDate === madridDate(itineraryDate)
        ? itineraryMap.get(number)
        : undefined;
    const validItinerary =
      itinerary &&
      String(itinerary.estaciones?.[0]?.p) === String(v.codOrigen) &&
      String(itinerary.estaciones?.at(-1)?.p) === String(v.codDestino)
        ? itinerary
        : undefined;
    const visorStops = (validItinerary?.estaciones || []).flatMap(
      (s: RecordData) => {
        const stop = catalog?.stops.get(String(s.p));
        return stop ? [{ ...stop, arrival: s.h, departure: s.hs }] : [];
      },
    );
    const stops: Stop[] = visorStops.length
      ? visorStops
      : trip
        ? catalog?.stopTimes.get(trip.trip_id) || []
        : [];
    const route = trip ? catalog?.routes.get(trip.route_id) : undefined;
    const product = products[Number(v.codProduct)];
    const name = route?.route_short_name || product?.[0] || "Renfe";
    const update = (trip ? updatesByTrip.get(trip.trip_id) : undefined) as
      RecordData | undefined;
    const previousIndex = stops.findIndex((s) => s.id === String(v.codEstAnt));
    const train: Train = {
      id: `renfe-ld-${number}`,
      number,
      name,
      service:
        product?.[1] ||
        (/AVE|AVLO/i.test(name)
          ? "Alta velocidad"
          : /AVANT|MD|REGIONAL|PROXIM/i.test(name)
            ? "Media distancia"
            : route
              ? "Larga distancia"
              : "Sin clasificar"),
      tripId: trip?.trip_id || `visor-${number}-${serviceDate || "sin-fecha"}`,
      routeId: trip?.route_id,
      origin: nameFor(v.codOrigen),
      destination: nameFor(v.codDestino),
      lat,
      lon,
      delay: finite(v.ultRetraso),
      delayTimestamp: timestamp,
      delayStale:
        !timestamp ||
        Date.now() / 1000 - timestamp > 120 ||
        timestamp - Date.now() / 1000 > 30,
      status: "UNKNOWN",
      timestamp,
      positionTimestampKind: timestamp ? "vehicle" : "unknown",
      sourceId: "visor-ld",
      nextStopId: String(v.codEstSig || ""),
      previousStopId: String(v.codEstAnt || ""),
      nextStop:
        nameFor(v.codEstSig) ||
        (v.codEstSig ? `Estación ${v.codEstSig}` : undefined),
      previousStop: nameFor(v.codEstAnt),
      nextArrival: parseMadridDate(v.horaLlegadaSigEst),
      rollingStock: typeof v.mat === "string" ? v.mat : undefined,
      accessible: typeof v.accesible === "boolean" ? v.accesible : null,
      speedKmh: null,
      speedKind: "unavailable",
      bearing: null,
      bearingKind: "unavailable",
      stops,
      canceled:
        (update?.trip?.scheduleRelationship ||
          update?.trip?.schedule_relationship) === "CANCELED",
      progress:
        stops.length > 1 && previousIndex >= 0
          ? (previousIndex / (stops.length - 1)) * 100
          : null,
      routePoints: (validItinerary?.secuencia || []).flatMap(
        (p: RecordData) => {
          const lat = finite(p.lat);
          const lon = finite(p.lon);
          return lat !== null && lon !== null
            ? [[lat, lon] as [number, number]]
            : [];
        },
      ),
      itinerarySource: visorStops.length
        ? "Renfe · itinerario del visor"
        : trip
          ? "GTFS · horario programado"
          : undefined,
    };
    const older = seen.get(number);
    if (!older || (train.timestamp || 0) > (older.timestamp || 0))
      seen.set(number, train);
  }
  const located = new Set(seen.keys());
  const unlocatedTrains: UnlocatedTrain[] = (
    Array.isArray(data.trenesNoPosicionados) ? data.trenesNoPosicionados : []
  )
    .filter(
      (v: RecordData) =>
        v.codComercial && !located.has(String(v.codComercial).padStart(5, "0")),
    )
    .map((v: RecordData) => ({
      number: String(v.codComercial).padStart(5, "0"),
      name: "Renfe",
      origin: nameFor(v.codOrigen),
      destination: nameFor(v.codDestino),
      sourceId: "visor-ld",
    }));
  return {
    trains: [...seen.values()],
    unlocatedTrains: [
      ...new Map(unlocatedTrains.map((t) => [t.number, t])).values(),
    ],
  };
}
