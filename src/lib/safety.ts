import type { DataSource, Incident } from "../types.ts";

// Classification of published text, never a probability of an accident.
export function accidentEvidence(
  text: string,
): "reported" | "reference" | "none" {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const heading = normalized.split(/[.!?\n]/)[0];
  if (/\bsimulacro\b|\baniversario\b|\bconmemoracion\b/.test(heading) && !/\bno (?:es|era|se trata de) (?:un )?simulacro\b/.test(heading)) return 'reference';
  const accident =
    /\baccidentes?\b|\bdescarril\w*|\bcolisi(?:on|ones)\b|\bchoque\b|\balcance entre\b/;
  const clauses = normalized.split(/[.!?\n]+/).filter((c) => accident.test(c));
  if (!clauses.length) return "none";
  const reference =
    /\bsimulacro\b|\bejercicio\b|\baniversario\b|\bconmemoracion\b|\bprevencion de accidentes\b|\bsin accidentes\b|\bno (?:hay|hubo|se (?:han? |ha )?registrado) (?:ningun |ninguna |nuevos? )?(?:accidentes?|colisiones|descarril\w*)\b/;
  return clauses.some((c) => !reference.test(c)) ? "reported" : "reference";
}
export function prioritizeIncidents(incidents: Incident[]) {
  const rank = (i: Incident) =>
    (accidentEvidence(`${i.title}. ${i.description}`) === "reported"
      ? 100
      : 0) + (i.severity === "high" ? 10 : i.severity === "medium" ? 5 : 0);
  return [...incidents].sort(
    (a, b) =>
      rank(b) - rank(a) ||
      (b.start || 0) - (a.start || 0) ||
      a.id.localeCompare(b.id),
  );
}
export function accidentCoverage(
  sources: DataSource[],
  failed: boolean,
  now = Date.now() / 1000,
) {
  const source = sources.find((s) => s.id === "adif-traffic");
  if (
    failed ||
    !source ||
    source.status !== "ok" ||
    !source.fetchedAt ||
    now - source.fetchedAt > 180 ||
    source.fetchedAt - now > 30
  )
    return "unverified";
  return "partial"; // Even healthy public feeds cannot certify full accident coverage.
}
