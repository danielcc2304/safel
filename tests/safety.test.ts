import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accidentEvidence,
  accidentCoverage,
  prioritizeIncidents,
} from "../src/lib/safety.ts";
import { parseAdif } from "../server/adif.ts";
import type { Incident, DataSource } from "../src/types.ts";
const url = "https://www.adif.es/viajeros/estado-de-la-red";
const banner =
  '<div class="adif-aviso-wrapper"><div data-analytics-asset-id="42"><h1 class="adif-titulo-aviso">Accidente ferroviario</h1><div class="adif-aviso-contenido"><p>Se trabaja en el accidente con los servicios de emergencia.</p></div></div></div>';
const empty = "<main>En este momento no hay incidencias relevantes</main>";
test("prominent accident outside the normal listing is captured without invented date or coordinates", () => {
  const p = parseAdif(banner, "adif-traffic", url, 1000);
  assert.equal(p.incidents.length, 1);
  assert.equal(p.incidents[0].category, "Accidente");
  assert.equal(p.incidents[0].start, null);
  assert.equal(p.incidents[0].lat, undefined);
  assert.equal(p.partial, true);
});
test("responsive duplicated featured banners do not count twice", () =>
  assert.equal(
    parseAdif(banner + banner + empty, "adif-traffic", url, 1000).incidents
      .length,
    1,
  ));
test("maintenance never becomes a clean empty response", () => {
  assert.throws(() =>
    parseAdif(
      "<main>Esta sección se encuentra en mantenimiento. En este momento no hay incidencias relevantes</main>",
      "adif-traffic",
      url,
      1000,
    ),
  );
  assert.equal(
    parseAdif(
      banner + "<main>Esta sección está en mantenimiento</main>",
      "adif-traffic",
      url,
      1000,
    ).partial,
    true,
  );
});
test("accident terminology and reassuring injury statements do not hide a collision", () => {
  for (const text of [
    "Descarrilamiento de un tren",
    "Colisión entre trenes",
    "Choque frontal de trenes",
    "Alcance de un tren a otro",
    "Arrollamiento en vía",
    "Salida de vía",
    "No hay heridos tras el descarrilamiento",
    "No es un simulacro: accidente ferroviario",
    "Accidente durante un simulacro",
    "Simulacro suspendido. Se ha producido un accidente real.",
  ])
    assert.equal(accidentEvidence(text), "reported", text);
});
test("exercises, anniversaries and explicit absence are references, not new accident reports", () => {
  for (const text of [
    "Simulacro de accidente. Se ensaya un descarrilamiento.",
    "Aniversario del accidente ferroviario",
    "No hay accidentes",
    "Sin accidentes en la red",
    "No se han registrado accidentes",
  ])
    assert.equal(accidentEvidence(text), "reference", text);
  assert.equal(accidentEvidence("Retrasos por obras"), "none");
});
test("accident reports sort ahead of any number of routine notices without mutating the source list", () => {
  const routine = {
    id: "r",
    title: "Obras",
    description: "Mantenimiento",
    category: "Obras",
    severity: "high",
    start: null,
    sourceId: "alerts",
    url,
    routeIds: [],
    stopIds: [],
    location: "Madrid",
  } as Incident;
  const collision = {
    ...routine,
    id: "a",
    title: "Colisión entre trenes",
    severity: "info",
  } as Incident;
  const input = [
    ...Array.from({ length: 12 }, (_, i) => ({ ...routine, id: `r${i}` })),
    collision,
  ];
  assert.equal(prioritizeIncidents(input)[0].id, "a");
  assert.equal(input[0].id, "r0");
});
test("healthy transport or an old successful accident poll cannot certify accident coverage", () => {
  const source = {
    id: "adif-traffic",
    status: "ok",
    fetchedAt: 1000,
  } as DataSource;
  assert.equal(accidentCoverage([source], false, 1100), "partial");
  assert.equal(accidentCoverage([source], true, 1100), "unverified");
  assert.equal(accidentCoverage([source], false, 1200), "unverified");
  assert.equal(
    accidentCoverage([{ ...source, status: "stale" }], false, 1100),
    "unverified",
  );
  assert.equal(accidentCoverage([], false, 1100), "unverified");
});
