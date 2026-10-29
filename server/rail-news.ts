import { load } from "cheerio";
import type { DataSource, RailNews } from "../src/types.ts";
import { accidentEvidence } from "../src/lib/safety.ts";

const WINDOW = 72 * 3600;
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const clean = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const railway =
  /\b(?:tren(?:es)?|ferroviari\w*|ave|alvia|railway|rail|trains?|derail\w*)\b/;
const spain =
  /\b(?:espana|spain|spanish|renfe|adif|rodalies|cercanias|madrid|barcelona|toledo|urda|adamuz|cordoba|sevilla|malaga|jaen|almeria|granada|huelva|cadiz|valencia|valencia|alicante|castellon|murcia|albacete|cuenca|guadalajara|ciudad real|zaragoza|huesca|teruel|lleida|lerida|girona|gerona|tarragona|gelida|bilbao|bizkaia|vizcaya|gipuzkoa|guipuzcoa|alava|vitoria|navarra|pamplona|logrono|rioja|burgos|soria|segovia|avila|salamanca|valladolid|palencia|leon|zamora|asturias|oviedo|cantabria|santander|galicia|coruna|lugo|ourense|orense|pontevedra|badajoz|caceres|extremadura|mallorca|baleares|tenerife|canarias)\b/;
const foreign =
  /\b(?:india|pakistan|china|japon|japan|rusia|russia|argentina|mexico|chile|peru|bangladesh|indonesia|alemania|germany|francia|france|portugal|italia|italy|suiza|switzerland|estados unidos|united states|canada)\b/;

export function relevantRailNews(title: string, spanishMetadata = false) {
  const t = normalized(title);
  if (
    /\b(?:aniversario|anniversary|cronologia|simulacro|simulation|historia de|historicos)\b/.test(
      t,
    ) ||
    foreign.test(t)
  )
    return false;
  return (
    railway.test(t) &&
    (spanishMetadata || spain.test(t)) &&
    (accidentEvidence(title) === "reported" ||
      /\b(?:train crash|train collision|derailment|rail accident)\b/.test(t))
  );
}

export function canonicalNewsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (/^utm_|^(?:fbclid|gclid)$/.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return null;
  }
}
const recent = (at: number | null, now: number) =>
  at !== null &&
  Number.isFinite(at) &&
  at > 0 &&
  at <= now + 300 &&
  now - at <= WINDOW;
function gdeltDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  const at = Date.parse(iso);
  return Number.isFinite(at) &&
    new Date(at).toISOString().replace(".000", "") === iso
    ? at / 1000
    : null;
}

export function parseGdelt(payload: unknown, now: number): RailNews[] {
  const articles = (payload as { articles?: unknown } | null)?.articles;
  if (!Array.isArray(articles))
    throw new Error("Respuesta GDELT no reconocible");
  return deduplicateNews(
    articles.flatMap((a) => {
      if (!a || typeof a.title !== "string") return [];
      const title = clean(a.title),
        url = canonicalNewsUrl(a.url),
        indexedAt = gdeltDate(a.seendate);
      if (!url || !recent(indexedAt, now) || !relevantRailNews(title))
        return [];
      return [
        {
          id: `gdelt-${url}`,
          title,
          url,
          outlet: new URL(url).hostname.replace(/^www\./, ""),
          sourceId: "rail-news-gdelt",
          publishedAt: null,
          indexedAt,
          checkedAt: now,
        },
      ];
    }),
  );
}

export function rtveCandidates(html: string) {
  const $ = load(html);
  const headlines = $("h2 a[href], h3 a[href]");
  if (!headlines.length) throw new Error("Portada RTVE no reconocible");
  return [
    ...new Set(
      headlines.toArray().flatMap((e) => {
        const href = $(e).attr("href"),
          title = normalized($(e).text());
        if (
          !href ||
          !/accidente|descarril|colision|choque|arrollamiento/.test(title)
        )
          return [];
        const u = new URL(href, "https://www.rtve.es/noticias/");
        const id = /^\/noticias\/\d{8}\/[^/]+\/(\d+)\.shtml$/.exec(
          u.pathname,
        )?.[1];
        return u.hostname === "www.rtve.es" && id ? [id] : [];
      }),
    ),
  ].slice(0, 8);
}

export function parseRtveArticle(payload: unknown, now: number): RailNews[] {
  const items = (payload as { page?: { items?: unknown } } | null)?.page?.items;
  if (!Array.isArray(items)) throw new Error("Noticia RTVE no reconocible");
  return items.flatMap((a) => {
    if (!a || typeof a.title !== "string") return [];
    const title = clean(a.title),
      url = canonicalNewsUrl(a.htmlUrl);
    const topics = [
      a.mainCategory,
      ...(Array.isArray(a.otherTopicsName) ? a.otherTopicsName : []),
    ];
    const domestic = topics.some(
      (t) => typeof t === "string" && /^Noticias\/Espa[ñn]a(?:\/|$)/.test(t),
    );
    const publishedAt =
      typeof a.publicationDateTimestamp === "number"
        ? a.publicationDateTimestamp / 1000
        : null;
    if (
      !url ||
      new URL(url).hostname !== "www.rtve.es" ||
      !recent(publishedAt, now) ||
      !relevantRailNews(title, domestic)
    )
      return [];
    return [
      {
        id: `rtve-${url}`,
        title,
        url,
        outlet: "RTVE",
        sourceId: "rail-news-rtve",
        publishedAt,
        indexedAt: null,
        checkedAt: now,
      },
    ];
  });
}
export function deduplicateNews(items: RailNews[]) {
  const map = new Map<string, RailNews>();
  for (const item of items) {
    const old = map.get(item.url);
    if (!old || (!old.publishedAt && item.publishedAt)) map.set(item.url, item);
  }
  return [...map.values()].sort(
    (a, b) =>
      (b.publishedAt || b.indexedAt || 0) - (a.publishedAt || a.indexedAt || 0),
  );
}

export function gdeltUrl() {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  for (const [k, v] of Object.entries({
    query:
      '("train crash" OR "train collision" OR derailment OR "rail accident") (Spain OR Renfe OR Adif)',
    mode: "artlist",
    format: "json",
    maxrecords: "75",
    timespan: "3d",
    sort: "datedesc",
  }))
    url.searchParams.set(k, v);
  return url.toString();
}
const definitions = [
  {
    id: "rail-news-gdelt",
    name: "GDELT · noticias ferroviarias España",
    url: gdeltUrl(),
    interval: 900,
  },
  {
    id: "rail-news-rtve",
    name: "RTVE · noticias ferroviarias España",
    url: "https://www.rtve.es/noticias/",
    interval: 300,
  },
] as const;
type Result = { news: RailNews[]; source: DataSource; retryAt: number };
const cache = new Map<string, Result>();
const pending = new Map<string, Promise<Result>>();

export async function fetchRailNews() {
  return Promise.all(
    definitions.map(async (def) => {
      const now = Math.floor(Date.now() / 1000),
        previous = cache.get(def.id);
      if (previous && now < previous.retryAt)
        return {
          ...previous,
          news: previous.news.filter((n) =>
            recent(n.publishedAt || n.indexedAt, now),
          ),
        };
      const inFlight = pending.get(def.id);
      if (inFlight) return inFlight;
      const task = (async (): Promise<Result> => {
        const base = {
          id: def.id,
          name: def.name,
          url: def.url,
          cadence: `Consulta cada ${def.interval / 60} min`,
          scope:
            "Búsqueda periodística sobre accidentes ferroviarios en España en las últimas 72 h. No es una API de emergencias ni confirma vigencia, ubicación o afectación de trenes. Puede omitir sucesos y recoger referencias a accidentes anteriores.",
        };
        let retryAt = now + def.interval;
        try {
          const signal = AbortSignal.timeout(10000);
          const response = await fetch(def.url, {
            signal,
            headers: {
              Accept:
                def.id === "rail-news-gdelt" ? "application/json" : "text/html",
              "User-Agent": "Safel/1.0 (+https://safelapp.vercel.app)",
            },
          });
          if (!response.ok) {
            if (response.status === 429) {
              const delay = Number(response.headers.get("retry-after"));
              if (Number.isFinite(delay) && delay > 0)
                retryAt = now + Math.max(def.interval, Math.min(delay, 86400));
            }
            throw new Error(`HTTP ${response.status}`);
          }
          let news: RailNews[];
          let partial = false;
          if (def.id === "rail-news-gdelt")
            news = parseGdelt(await response.json(), now);
          else {
            const ids = rtveCandidates(await response.text());
            const results = await Promise.allSettled(
              ids.map(async (id) => {
                const article = await fetch(
                  `https://api.rtve.es/api/noticias/${id}.json`,
                  {
                    signal,
                    headers: {
                      Accept: "application/json",
                      "User-Agent": "Safel/1.0 (+https://safelapp.vercel.app)",
                    },
                  },
                );
                if (!article.ok) throw new Error(`HTTP ${article.status}`);
                return parseRtveArticle(await article.json(), now);
              }),
            );
            partial = results.some((r) => r.status === "rejected");
            if (ids.length && results.every((r) => r.status === "rejected"))
              throw new Error(
                "No se han podido verificar las fechas de las noticias de RTVE",
              );
            news = results.flatMap((r) =>
              r.status === "fulfilled" ? r.value : [],
            );
          }
          const result: Result = {
            news: deduplicateNews(news),
            source: {
              ...base,
              status: partial ? "stale" : "ok",
              fetchedAt: now,
              timestamp: null,
              ...(partial
                ? {
                    error:
                      "Lectura parcial de RTVE: algunas fichas no han respondido. Se muestran solo las verificadas.",
                  }
                : {}),
            },
            retryAt,
          };
          cache.set(def.id, result);
          return result;
        } catch (error) {
          const detail =
            error instanceof Error && /^HTTP \d{3}$/.test(error.message)
              ? error.message
              : error instanceof Error &&
                  (error.name === "TimeoutError" || error.name === "AbortError")
                ? "Tiempo de espera agotado (10 s)"
                : "Descarga o formato no disponible";
          const result: Result = {
            news: (previous?.news || []).filter((n) =>
              recent(n.publishedAt || n.indexedAt, now),
            ),
            source: {
              ...base,
              status: previous?.source.fetchedAt ? "stale" : "unavailable",
              fetchedAt: previous?.source.fetchedAt || null,
              timestamp: null,
              error: `${detail}. No se interpreta como ausencia de accidentes; no se realizan reintentos hasta la siguiente consulta programada.`,
            },
            retryAt,
          };
          cache.set(def.id, result);
          return result;
        }
      })();
      pending.set(def.id, task);
      try {
        return await task;
      } finally {
        pending.delete(def.id);
      }
    }),
  );
}
