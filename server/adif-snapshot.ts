import type { DataSource, Incident } from "../src/types.ts";

export const ADIF_SNAPSHOT_URL =
  "https://raw.githubusercontent.com/danielcc2304/safel/rail-data/adif.json";
export const SNAPSHOT_FRESH_SECONDS = 900;
const MAX_AGE = 86400;
export interface AdifRecord {
  source: DataSource;
  incidents: Incident[];
}
export interface AdifSnapshot {
  version: 1;
  generatedAt: number;
  records: AdifRecord[];
}
const urls: Record<string, string> = {
  "adif-traffic": "https://www.adif.es/viajeros/estado-de-la-red",
  "adif-works": "https://www.adif.es/viajeros/avisos",
};
const categories = [
  "Infraestructura",
  "Catenaria",
  "Circulación",
  "Obras",
  "Meteorología",
  "Accesibilidad",
  "Accidente",
];
const text = (v: unknown, max = 20000): v is string =>
  typeof v === "string" && v.length <= max;
const date = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 100 && v.every((x) => text(x, 500));
const trustedLink = (value: unknown) => {
  if (!text(value, 2000)) return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.hostname === "www.adif.es" &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
};

// Treat the public copy as untrusted input. No HTML, arbitrary URLs, dates or coordinates are accepted.
export function parseAdifSnapshot(
  value: unknown,
  now = Date.now() / 1000,
): AdifSnapshot {
  const data = value as AdifSnapshot;
  if (
    !data ||
    data.version !== 1 ||
    !date(data.generatedAt) ||
    data.generatedAt > now + 30 ||
    now - data.generatedAt > MAX_AGE ||
    !Array.isArray(data.records) ||
    data.records.length !== 2
  )
    throw new Error("Copia de Adif inválida o caducada");
  const seen = new Set<string>();
  const records = data.records.map((record) => {
    const s = record?.source;
    if (
      !s ||
      !urls[s.id] ||
      seen.has(s.id) ||
      s.url !== urls[s.id] ||
      !["ok", "stale", "unavailable"].includes(s.status) ||
      !text(s.name, 100) ||
      !text(s.scope) ||
      !text(s.cadence, 200) ||
      (s.error !== undefined && !text(s.error, 1000)) ||
      (s.timestamp !== null &&
        (!date(s.timestamp) || s.timestamp > now + 300)) ||
      (s.fetchedAt !== null &&
        (!date(s.fetchedAt) || s.fetchedAt > data.generatedAt + 30)) ||
      !Array.isArray(record.incidents) ||
      record.incidents.length > 300 ||
      (s.fetchedAt === null &&
        (record.incidents.length > 0 || s.status !== "unavailable"))
    )
      throw new Error("Fuente de Adif inválida");
    seen.add(s.id);
    const incidents = record.incidents.map((i) => {
      if (
        !i ||
        !text(i.id, 2000) ||
        !i.id.startsWith(s.id + "-") ||
        !text(i.title, 1000) ||
        !i.title.trim() ||
        !text(i.description) ||
        !categories.includes(i.category) ||
        !["info", "medium", "high"].includes(i.severity) ||
        !text(i.location, 1000) ||
        !trustedLink(i.url) ||
        i.sourceId !== s.id ||
        !strings(i.routeIds) ||
        !strings(i.stopIds) ||
        (i.regions !== undefined && !strings(i.regions)) ||
        !date(i.checkedAt) ||
        i.checkedAt > s.fetchedAt! + 30 ||
        (i.start !== null && (!date(i.start) || i.start > now + 300))
      )
        throw new Error("Comunicado de Adif inválido");
      return {
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        severity: i.severity,
        location: i.location,
        start: i.start,
        sourceId: s.id,
        sourceName: "Adif",
        url: i.url,
        routeIds: i.routeIds,
        stopIds: i.stopIds,
        checkedAt: i.checkedAt,
        regions: i.regions,
        summaryOnly: i.summaryOnly === true,
        locationNote: "El comunicado no publica coordenadas verificadas.",
      } satisfies Incident;
    });
    return {
      incidents,
      source: {
        id: s.id,
        name: s.name,
        url: s.url,
        status: s.status,
        timestamp: s.timestamp,
        fetchedAt: s.fetchedAt,
        cadence: s.cadence,
        scope: s.scope,
        ...(s.error ? { error: s.error } : {}),
      },
    };
  });
  return { version: 1, generatedAt: data.generatedAt, records };
}

export function snapshotRecord(
  snapshot: AdifSnapshot,
  id: string,
  now: number,
): AdifRecord | null {
  const record = snapshot.records.find((r) => r.source.id === id);
  if (!record?.source.fetchedAt || now - record.source.fetchedAt > MAX_AGE)
    return null;
  return {
    incidents: record.incidents,
    source: {
      ...record.source,
      delivery: "snapshot",
      cadence: "Copia programada cada 5 min · puede retrasarse",
      status:
        record.source.status === "ok" &&
        now - record.source.fetchedAt <= SNAPSHOT_FRESH_SECONDS
          ? "ok"
          : "stale",
      ...(now - record.source.fetchedAt > SNAPSHOT_FRESH_SECONDS
        ? {
            error:
              "La copia de Adif no tiene una descarga reciente. Se conserva su fecha original.",
          }
        : {}),
    },
  };
}

export async function readAdifSnapshot(): Promise<{
  data: AdifSnapshot | null;
  error?: string;
}> {
  const failures: string[] = [];
  for (const [label, url, accept] of [
    ["GitHub Raw", ADIF_SNAPSHOT_URL, "application/json"],
    [
      "GitHub API",
      "https://api.github.com/repos/danielcc2304/safel/contents/adif.json?ref=rail-data",
      "application/vnd.github.raw+json",
    ],
  ]) {
    let stage = "conexión";
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          Accept: accept,
          "User-Agent": "Safel/1.0 (public rail bulletin reader)",
        },
      });
      if (!response.ok) {
        failures.push(`${label}: HTTP ${response.status}`);
        continue;
      }
      stage = "lectura";
      const body = await response.text();
      if (body.length > 2_000_000) {
        failures.push(`${label}: tamaño no admitido`);
        continue;
      }
      stage = "validación";
      return { data: parseAdifSnapshot(JSON.parse(body)) };
    } catch (error) {
      failures.push(
        `${label}: ${error instanceof Error && error.name === "TimeoutError" ? "tiempo de espera agotado" : stage + " fallida"}`,
      );
    }
  }
  const error = `Copia de respaldo no disponible (${failures.join("; ")}).`;
  console.warn(`[Safel] adif-snapshot: ${error}`);
  return { data: null, error };
}

export async function fetchAdifSnapshot(): Promise<AdifSnapshot | null> {
  return (await readAdifSnapshot()).data;
}
