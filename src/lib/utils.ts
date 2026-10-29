import type { Incident, Train } from "../types";
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
export function matchesTrain(train: Train, query: string) {
  return normalize(
    [
      train.number,
      train.name,
      train.origin,
      train.destination,
      train.nextStop,
      ...train.stops.map((s) => s.name),
    ].join(" "),
  ).includes(normalize(query));
}
export function formatTime(timestamp: number | null, date = false) {
  if (!timestamp) return "No disponible";
  return new Date(timestamp * 1000).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    ...(date ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function relativeTime(timestamp: number | null, now = Date.now()) {
  if (!timestamp) return "Sin fecha";
  if (timestamp * 1000 - now > 60_000)
    return `Previsto ${formatTime(timestamp, true)}`;
  const minutes = Math.max(0, Math.floor((now / 1000 - timestamp) / 60));
  if (minutes < 1) return "Hace unos segundos";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} días`;
}
export const severityLabels = {
  high: "Afectación alta",
  medium: "Precaución",
  info: "Información",
};
export function relatedIncidents(train: Train, incidents: Incident[]) {
  return incidents.filter(
    (i) =>
      (train.routeId && i.routeIds.includes(train.routeId)) ||
      i.stopIds.includes(train.nextStopId || "") ||
      train.stops.some((s) => i.stopIds.includes(s.id)),
  );
}
export function formatTrainCsv(trains: Train[], demo: boolean) {
  const rows = [
    [
      "modo",
      "tren",
      "servicio",
      "origen",
      "destino",
      "retraso_min",
      "latitud",
      "longitud",
      "fecha_fuente",
      "tipo_fecha_posicion",
      "velocidad_kmh",
      "tipo_velocidad",
      "ventana_estimacion_s",
      "rumbo_grados",
      "tipo_rumbo",
      "fecha_demora",
      "proxima_estacion",
      "llegada_proxima_estacion",
      "anden",
      "material",
      "accesibilidad_publicada",
      "fuente",
    ],
    ...trains.map((t) => [
      demo ? "demostración" : "fuente pública",
      t.number,
      t.service,
      t.origin || "",
      t.destination || "",
      t.delay ?? "",
      t.lat,
      t.lon,
      t.timestamp ? new Date(t.timestamp * 1000).toISOString() : "",
      t.positionTimestampKind || "unknown",
      t.speedKmh ?? "",
      t.speedKind || "unavailable",
      t.speedWindowSeconds ?? "",
      t.bearing ?? "",
      t.bearingKind || "unavailable",
      t.delayTimestamp ? new Date(t.delayTimestamp * 1000).toISOString() : "",
      t.nextStop || "",
      t.nextArrival ? new Date(t.nextArrival * 1000).toISOString() : "",
      t.platform || "",
      t.rollingStock || "",
      t.accessible == null ? "" : t.accessible ? "sí" : "no",
      t.sourceId,
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (c) =>
              `"${(typeof c === "string" && /^[=+\-@\t\r]/.test(c) ? "'" + c : String(c)).replaceAll('"', '""')}"`,
          )
          .join(";"),
      )
      .join("\r\n")
  );
}
export function downloadCsv(trains: Train[], demo: boolean) {
  const csv = formatTrainCsv(trains, demo);
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `safel-trenes-${demo ? "demo-" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
