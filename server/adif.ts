import { load } from "cheerio";
import type { Category, DataSource, Incident } from "../src/types.ts";
import { parseMadridDate } from "./telemetry.ts";
import { accidentEvidence } from "../src/lib/safety.ts";
import { adifFailure } from "./adif-diagnostics.ts";
import { fetchAdifSnapshot, snapshotRecord } from "./adif-snapshot.ts";

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
export function incidentCategory(text: string): Category {
  return accidentEvidence(text) !== "none"
    ? "Accidente"
    : /catenaria|tensión|electrific|pantógrafo/i.test(text)
      ? "Catenaria"
      : /ascensor|escalera|accesib/i.test(text)
        ? "Accesibilidad"
        : /obra|mantenimiento/i.test(text)
          ? "Obras"
          : /lluvia|viento|inunda|nieve|meteor/i.test(text)
            ? "Meteorología"
            : /vía|infraestructura/i.test(text)
              ? "Infraestructura"
              : "Circulación";
}
export function parseAdif(
  html: string,
  sourceId: string,
  url: string,
  checkedAt: number,
) {
  const $ = load(html);
  const incidents: Incident[] = [];
  const traffic = sourceId === "adif-traffic";
  const nodes = traffic
    ? $(".listado-informacion-red-contenedor article.aviso-item")
    : $(".avisos-grid a.aviso-card");
  const knownEmpty = /En este momento no hay incidencias relevantes/i.test(
    $("#main-content,main").text(),
  );
  const maintenance =
    /(?:secci[oó]n|p[aá]gina).{0,65}(?:mantenimiento|no (?:est[aá] )?disponible)/i.test(
      clean($("#main-content,main").text()),
    );
  if (traffic)
    $(".adif-aviso-wrapper").each((index, element) => {
      const node = $(element);
      const title = clean(node.find(".adif-titulo-aviso").text());
      const description = node
        .find(".adif-aviso-contenido")
        .find("p,li")
        .map((_, p) => clean($(p).text()))
        .get()
        .join("\n\n");
      if (
        !title ||
        !description ||
        accidentEvidence(`${title}. ${description}`) !== "reported"
      )
        return;
      incidents.push({
        id: `${sourceId}-featured-${node.find("[data-analytics-asset-id]").first().attr("data-analytics-asset-id") || encodeURIComponent(title).slice(0, 160) || index}`,
        title,
        description,
        category: "Accidente",
        severity: "info",
        location: "Ámbito descrito en el comunicado de Adif",
        start: null,
        checkedAt,
        sourceId,
        sourceName: "Adif",
        url,
        routeIds: [],
        stopIds: [],
        locationNote:
          "Aviso destacado de la web oficial. Sin fecha individual ni coordenadas verificadas: consultar vigencia y ámbito en el original.",
      });
    });
  if (
    (!nodes.length && !knownEmpty && !incidents.length) ||
    (!nodes.length && maintenance && !incidents.length)
  )
    throw new Error(
      "La estructura del boletín de Adif ha cambiado o no se ha podido verificar",
    );
  const dateText = clean($(".fecha-actualizacion__text").first().text());
  const date = dateText.match(/(\d{2})-(\d{2})-(\d{4})\s*\/\s*(\d{2}):(\d{2})/);
  const pageTimestamp = date
    ? parseMadridDate(
        `${date[3]}-${date[2]}-${date[1]}T${date[4]}:${date[5]}:00`,
      )
    : null;
  nodes.each((index, element) => {
    const node = $(element);
    const title = clean(
      traffic
        ? node.find(".aviso-card__titulo").text()
        : node
            .find(".sr-only")
            .text()
            .replace(/^Leer aviso:\s*/i, "") ||
            node.find(".aviso-card__fecha").text(),
    );
    const description = node.find(".aviso-card__content p").length
      ? node
          .find(".aviso-card__content p")
          .map((_, p) => clean($(p).text()))
          .get()
          .join("\n\n")
      : clean(node.find(".aviso-card__content").text());
    if (!title || !description) throw new Error("Aviso de Adif incompleto");
    const scope = clean(
      node.find(traffic ? ".aviso-item__ambito" : ".aviso-card__header").text(),
    );
    const href = node.attr("href");
    let link = url;
    if (href) {
      const parsed = new URL(href, url);
      if (parsed.protocol === "https:" && parsed.hostname === "www.adif.es")
        link = parsed.toString();
    }
    const category = incidentCategory(`${title} ${description}`);
    incidents.push({
      id: `${sourceId}-${node.attr("data-article-id") || (href ? new URL(link).pathname : index)}`,
      title,
      description,
      category,
      // The page's red card is not a risk score. Only explicit service suspension determines high impact.
      severity:
        traffic &&
        /(?:está|se encuentra|permanece) interrumpid[ao]|se encuentra suspendid[ao]/i.test(
          description,
        )
          ? "high"
          : "info",
      location: scope || "Ámbito indicado por Adif",
      regions: scope.split(/\s*\/\s*|\s+-\s+/).filter(Boolean),
      start: null,
      checkedAt,
      summaryOnly: !traffic,
      sourceId,
      sourceName: "Adif",
      url: link,
      routeIds: [],
      stopIds: [],
      locationNote:
        "El boletín no publica coordenadas verificadas. No se sitúa un pin en un punto supuesto.",
    });
  });
  return {
    incidents: [
      ...new Map(
        incidents.map((i) => [`${clean(i.title)}:${clean(i.description)}`, i]),
      ).values(),
    ],
    pageTimestamp,
    partial: maintenance || (!nodes.length && !knownEmpty),
  };
}
const definitions = [
  {
    id: "adif-traffic",
    name: "Adif · estado de la red",
    url: "https://www.adif.es/viajeros/estado-de-la-red",
  },
  {
    id: "adif-works",
    name: "Adif · avisos y obras",
    url: "https://www.adif.es/viajeros/avisos",
  },
];
const cache = new Map<
  string,
  { incidents: Incident[]; source: DataSource; attemptedAt: number }
>();
export async function fetchAdif({ allowSnapshot = true } = {}) {
  const now = Math.floor(Date.now() / 1000);
  let snapshot: ReturnType<typeof fetchAdifSnapshot> | undefined;
  return Promise.all(
    definitions.map(async (def) => {
      const previous = cache.get(def.id);
      const interval = def.id === "adif-traffic" ? 60 : 300;
      if (previous && now - previous.attemptedAt < interval) return previous;
      const base = {
        ...def,
        cadence:
          def.id === "adif-traffic"
            ? "Consulta cada minuto"
            : "Consulta cada 5 min",
        scope:
          "Extracción de boletines públicos HTML de Adif, no una API ni un canal interno de maquinistas. Fecha de actualización de página cuando existe; no equivale a fecha de cada aviso.",
      };
      let stage: "download" | "parse" = "download";
      try {
        const response = await fetch(def.url, {
          signal: AbortSignal.timeout(9000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        stage = "parse";
        const parsed = parseAdif(html, def.id, def.url, now);
        const source: DataSource = {
          ...base,
          delivery: "direct",
          status:
            parsed.partial ||
            (parsed.pageTimestamp != null &&
              (now - parsed.pageTimestamp > 86400 ||
                parsed.pageTimestamp - now > 300))
              ? "stale"
              : "ok",
          timestamp: parsed.pageTimestamp,
          fetchedAt: now,
          ...(parsed.partial
            ? {
                error:
                  "Adif indica mantenimiento o la extracción es parcial. Se conservan los comunicados recuperados, sin confirmar cobertura completa.",
              }
            : {}),
        };
        const result = {
          incidents: parsed.incidents,
          source,
          attemptedAt: now,
        };
        cache.set(def.id, result);
        return result;
      } catch (error) {
        const reason = adifFailure(error, stage);
        console.warn(`[Safel] ${def.id}: ${reason}`);
        if (allowSnapshot) {
          snapshot ??= fetchAdifSnapshot();
          const saved = await snapshot;
          const fallback = saved ? snapshotRecord(saved, def.id, now) : null;
          if (
            fallback &&
            (fallback.source.fetchedAt || 0) >=
              (previous?.source.fetchedAt || 0)
          ) {
            const result = { ...fallback, attemptedAt: now };
            cache.set(def.id, result);
            return result;
          }
        }
        const result = {
          incidents: previous?.incidents || [],
          source: {
            ...base,
            status: previous?.incidents.length ? "stale" : "unavailable",
            timestamp: previous?.source.timestamp || null,
            fetchedAt: previous?.source.fetchedAt || null,
            error: `${reason} Consulta Adif directamente; no se interpreta como ausencia de incidencias.`,
          } as DataSource,
          attemptedAt: now,
        };
        cache.set(def.id, result);
        return result;
      }
    }),
  );
}
