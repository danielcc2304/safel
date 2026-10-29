export type Service =
  | "Alta velocidad"
  | "Larga distancia"
  | "Cercanías"
  | "Media distancia"
  | "Sin clasificar";
export type Severity = "high" | "medium" | "info";
export type Category =
  | "Infraestructura"
  | "Catenaria"
  | "Circulación"
  | "Obras"
  | "Accesibilidad"
  | "Meteorología"
  | "Accidente";
export type SourceStatus = "ok" | "stale" | "unavailable";
export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  arrival?: string;
  departure?: string;
}
export interface Train {
  id: string;
  number: string;
  name: string;
  service: Service;
  tripId: string;
  routeId?: string;
  origin?: string;
  destination?: string;
  lat: number;
  lon: number;
  delay: number | null;
  status: string;
  timestamp: number | null;
  nextStop?: string;
  stops: Stop[];
  sourceId: string;
  canceled?: boolean;
  delayTimestamp?: number | null;
  delayStale?: boolean;
  speedKmh?: number | null;
  speedKind?: "reported" | "estimated" | "unavailable";
  speedWindowSeconds?: number | null;
  bearing?: number | null;
  bearingKind?: "reported" | "estimated" | "unavailable";
  positionTimestampKind?: "vehicle" | "feed" | "unknown";
  platform?: string;
  rollingStock?: string;
  accessible?: boolean | null;
  nextArrival?: number | null;
  previousStop?: string;
  positionStale?: boolean;
  progress?: number | null;
  stopSequence?: number | null;
  occupancy?: string;
  odometerKm?: number | null;
  routePoints?: [number, number][];
  itinerarySource?: string;
  nextStopId?: string;
  previousStopId?: string;
}
export interface Incident {
  id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  location: string;
  start: number | null;
  end?: number | null;
  sourceId: string;
  url: string;
  routeIds: string[];
  stopIds: string[];
  lat?: number;
  lon?: number;
  checkedAt?: number;
  sourceName?: string;
  cause?: string;
  effect?: string;
  regions?: string[];
  locationNote?: string;
  summaryOnly?: boolean;
}
export interface DataSource {
  id: string;
  name: string;
  url: string;
  status: SourceStatus;
  timestamp: number | null;
  fetchedAt: number | null;
  cadence: string;
  scope: string;
  error?: string;
}
export interface UnlocatedTrain {
  number: string;
  name: string;
  origin?: string;
  destination?: string;
  sourceId: string;
}
export interface NetworkData {
  railNews?: RailNews[];
  stations?: Stop[];
  trains: Train[];
  incidents: Incident[];
  sources: DataSource[];
  fetchedAt: number;
  demo: boolean;
  unlocatedTrains?: UnlocatedTrain[];
}
export interface RailNews {
  id: string;
  title: string;
  url: string;
  outlet: string;
  sourceId: string;
  publishedAt: number | null;
  indexedAt: number | null;
  checkedAt: number;
}
export type Page =
  "map" | "trains" | "incidents" | "saved" | "stations" | "sources";
