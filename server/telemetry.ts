import type { Train } from "../src/types.ts";

export function finite(value: unknown): number | null {
  return value === undefined ||
    value === null ||
    value === "" ||
    !Number.isFinite(Number(value))
    ? null
    : Number(value);
}
export function parseMadridDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t / 1000 : null;
  }
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const parts = m.slice(1).map((x) => Number(x || 0));
  const utc = Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2],
    parts[3],
    parts[4],
    parts[5],
  );
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const matches = [60, 120]
    .map((offset) => utc - offset * 60_000)
    .filter((t) => {
      const p = Object.fromEntries(
        fmt.formatToParts(t).map((x) => [x.type, x.value]),
      );
      return [p.year, p.month, p.day, p.hour, p.minute, p.second]
        .map(Number)
        .every((n, i) => n === parts[i]);
    });
  // Reject ambiguous/nonexistent DST times rather than assigning the wrong observation time.
  return matches.length === 1 ? matches[0] / 1000 : null;
}
export function madridDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp * 1000);
}
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const r = Math.PI / 180;
  const lat = (b.lat - a.lat) * r;
  const lon = (b.lon - a.lon) * r;
  const x =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function motionBetween(a: Train, b: Train, now: number) {
  if (
    a.positionTimestampKind !== "vehicle" ||
    b.positionTimestampKind !== "vehicle" ||
    !a.timestamp ||
    !b.timestamp ||
    a.tripId !== b.tripId
  )
    return null;
  const seconds = b.timestamp - a.timestamp;
  if (
    seconds < 5 ||
    seconds > 180 ||
    now - b.timestamp > 120 ||
    b.timestamp - now > 30
  )
    return null;
  const meters = distanceMeters(a, b);
  const speedKmh = (meters / seconds) * 3.6;
  if (speedKmh > 450) return null; // GPS discontinuity, not an overspeed detection.
  const r = Math.PI / 180;
  const delta = (b.lon - a.lon) * r;
  const y = Math.sin(delta) * Math.cos(b.lat * r);
  const x =
    Math.cos(a.lat * r) * Math.sin(b.lat * r) -
    Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(delta);
  return {
    speedKmh: Math.round(speedKmh),
    bearing: meters >= 30 ? (Math.atan2(y, x) / r + 360) % 360 : null,
    seconds,
  };
}
export class MotionHistory {
  private samples = new Map<string, Train>();
  apply(trains: Train[], now = Math.floor(Date.now() / 1000)) {
    for (const train of trains) {
      const key = `${train.sourceId}:${train.number}`;
      const previous = this.samples.get(key);
      const maxAge = train.sourceId === "positions-ld" ? 1200 : 120;
      train.positionStale =
        !train.timestamp ||
        now - train.timestamp > maxAge ||
        train.timestamp - now > 30;
      if (train.speedKind !== "reported") {
        train.speedKmh = null;
        train.speedKind = "unavailable";
        train.speedWindowSeconds = null;
        const motion = previous ? motionBetween(previous, train, now) : null;
        if (motion) {
          train.speedKmh = motion.speedKmh;
          train.speedKind = "estimated";
          train.speedWindowSeconds = motion.seconds;
        } else if (
          previous?.timestamp === train.timestamp &&
          previous.speedKind === "estimated" &&
          previous.lat === train.lat &&
          previous.lon === train.lon &&
          train.timestamp !== null &&
          now - train.timestamp <= 120 &&
          previous.tripId === train.tripId &&
          !train.positionStale
        ) {
          train.speedKmh = previous.speedKmh;
          train.speedKind = previous.speedKind;
          train.speedWindowSeconds = previous.speedWindowSeconds;
          if (train.bearing == null && previous.bearingKind === "estimated") {
            train.bearing = previous.bearing;
            train.bearingKind = "estimated";
          }
        }
        if (train.bearing == null && motion?.bearing != null) {
          train.bearing = motion.bearing;
          train.bearingKind = "estimated";
        }
      }
      if (
        train.timestamp &&
        (!previous?.timestamp || train.timestamp > previous.timestamp)
      )
        this.samples.set(key, { ...train });
    }
    for (const [key, train] of this.samples)
      if (!train.timestamp || now - train.timestamp > 3600)
        this.samples.delete(key);
    return trains;
  }
}
