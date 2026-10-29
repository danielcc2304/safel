import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { DataSource, Incident } from "../src/types.ts";
import { incidentCategory } from "./adif.ts";

export const RODALIES_URL =
  "https://www.gencat.cat/rodalies/incidencies_rodalies_rss_es_ES.xml";
const source = {
  id: "rodalies-alerts",
  name: "Generalitat · incidencias de Rodalies",
  url: RODALIES_URL,
  cadence: "Consulta cada minuto",
  scope:
    "RSS oficial de incidencias de Rodalies y regionales de Cataluña. No cubre toda España ni garantiza detectar todos los accidentes. La fecha de cada aviso es su publicación, no su resolución.",
};
export function parseRodalies(xml: string, now: number) {
  const $ = load(xml, { xmlMode: true });
  if (
    $("rss > channel").length !== 1 ||
    !/Rodalies/i.test($("channel > title").first().text())
  )
    throw new Error("RSS de Rodalies no reconocible");
  const parseDate = (value: string) => {
    const n = Date.parse(value) / 1000;
    return Number.isFinite(n) && n > 0 && n <= now + 300 ? n : null;
  };
  const timestamp = parseDate(
    $("channel > lastBuildDate, channel > pubDate").first().text(),
  );
  if (!timestamp && !$("channel > item").length)
    throw new Error("RSS vacío sin fecha de generación verificable");
  const incidents: Incident[] = [];
  $("channel > item").each((_, item) => {
    const node = $(item);
    const title = load(node.find("title").text())
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const description = load(node.find("description").text())
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const start = parseDate(node.find("pubDate").text());
    if (!title || !description || !start)
      throw new Error("Aviso de Rodalies incompleto");
    incidents.push({
      id: `rodalies-${createHash("sha256").update(`${title}\n${description}\n${start}`).digest("hex").slice(0, 24)}`,
      title,
      description,
      start,
      checkedAt: now,
      category: incidentCategory(`${title} ${description}`),
      severity: "info",
      location: "Cataluña",
      regions: ["Cataluña"],
      sourceId: source.id,
      sourceName: "Generalitat de Catalunya · Rodalies",
      url: "https://rodalies.gencat.cat/ca/alteracions_del_servei/",
      routeIds: [],
      stopIds: [],
      locationNote:
        "El RSS no publica coordenadas. El nombre de línea no se cruza con identificadores GTFS de otras redes.",
    });
  });
  return {
    incidents: [...new Map(incidents.map((i) => [i.id, i])).values()],
    timestamp,
  };
}
let cached: { incidents: Incident[]; source: DataSource } | undefined;
let attemptedAt = -Infinity;
let inFlight:
  Promise<{ incidents: Incident[]; source: DataSource }> | undefined;
export async function fetchRodalies() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - attemptedAt < 60) return cached;
  if (inFlight) return inFlight;
  attemptedAt = now;
  inFlight = (async () => {
    try {
      const response = await fetch(RODALIES_URL, {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (!response.ok) throw new Error("RSS no disponible");
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error("RSS demasiado grande");
      const parsed = parseRodalies(body, now);
      cached = {
        incidents: parsed.incidents,
        source: {
          ...source,
          timestamp: parsed.timestamp,
          fetchedAt: now,
          status:
            parsed.timestamp && now - parsed.timestamp <= 900 ? "ok" : "stale",
          ...(!parsed.timestamp || now - parsed.timestamp > 900
            ? {
                error:
                  "El canal no tiene una fecha de generación reciente verificable.",
              }
            : {}),
        },
      };
    } catch {
      cached = {
        incidents: cached?.incidents || [],
        source: {
          ...source,
          timestamp: cached?.source.timestamp || null,
          fetchedAt: cached?.source.fetchedAt || null,
          status: cached?.source.fetchedAt ? "stale" : "unavailable",
          error:
            "No se ha podido actualizar el RSS oficial. Se conserva la última respuesta con su fecha original.",
        },
      };
    }
    return cached;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}
