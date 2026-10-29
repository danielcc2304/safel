import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdif } from "../server/adif.ts";
import { normalizeVisor, stationsFromVisor } from "../server/visor.ts";
import { madridDate } from "../server/telemetry.ts";
import type { Schedule } from "../server/network.ts";

const now = Math.floor(Date.now() / 1000);
const catalog: Schedule = {
  trips: new Map(),
  routes: new Map(),
  stopTimes: new Map(),
  stops: new Map([
    ["00100", { id: "00100", name: "Origen real", lat: 40.4, lon: -3.7 }],
    ["00200", { id: "00200", name: "Destino real", lat: 41.4, lon: -2.7 }],
  ]),
};
const raw = {
  codComercial: "03113",
  codProduct: 2,
  codOrigen: "00100",
  codDestino: "00200",
  codEstAnt: "00100",
  codEstSig: "00200",
  latitud: 40.4,
  longitud: -3.7,
  ultRetraso: "0",
  time: now,
  p: "2",
  mat: "112010",
  accesible: false,
};
test("visor metadata preserves zero delay, false accessibility and unknown velocity; p is never invented as a platform", () => {
  const [train] = normalizeVisor({ trenes: [raw] }, catalog, null).trains;
  assert.equal(train.origin, "Origen real");
  assert.equal(train.destination, "Destino real");
  assert.equal(train.delay, 0);
  assert.equal(train.accessible, false);
  assert.equal(train.platform, undefined);
  assert.equal(train.speedKmh, null);
  assert.equal(train.rollingStock, "112010");
  assert.equal(train.service, "Alta velocidad");
  assert.equal(
    normalizeVisor({ trenes: [{ ...raw, time: now + 3600 }] }, catalog, null)
      .trains[0].delayStale,
    true,
  );
});
test("an unrelated/old GTFS trip with the same number is not used for visor cancellation or delay", () => {
  const oldCatalog = {
    ...catalog,
    trips: new Map([
      [
        "old",
        {
          trip_id: "0311312020-01-01",
          trip_short_name: "03113",
          route_id: "old-route",
        },
      ],
    ]),
  };
  const [train] = normalizeVisor({ trenes: [raw] }, oldCatalog, {
    entity: [
      {
        tripUpdate: {
          trip: {
            tripId: "0311312020-01-01",
            scheduleRelationship: "CANCELED",
          },
          delay: 999,
        },
      },
    ],
  }).trains;
  assert.equal(train.canceled, false);
  assert.equal(train.delay, 0);
  assert.equal(train.routeId, undefined);
});
test("unlocated services remain separate, deduplicated and never given made-up coordinates", () => {
  const data = normalizeVisor(
    {
      trenes: [raw, { ...raw, latitud: 41, time: now - 60 }],
      trenesNoPosicionados: [
        { codComercial: "11111", codOrigen: "00100" },
        { codComercial: "11111" },
        raw,
      ],
    },
    catalog,
    null,
  );
  assert.equal(data.trains.length, 1);
  assert.equal(data.trains[0].lat, 40.4);
  assert.equal(data.unlocatedTrains.length, 1);
  assert.equal(data.unlocatedTrains[0].number, "11111");
  assert.equal("lat" in data.unlocatedTrains[0], false);
});
test("official stations recover leading zeroes from numeric station codes", () => {
  assert.equal(
    stationsFromVisor({
      features: [
        {
          properties: { CODIGO: 100, NOMBRE: "Estación" },
          geometry: { coordinates: [-3, 40] },
        },
      ],
    })[0].id,
    "00100",
  );
});
test("itinerary requires same service date and both endpoint codes before attaching published waypoints", () => {
  const date = madridDate(now);
  const itineraries = {
    fechaActualizacion: `${date}T12:00:00`,
    trenes: [
      {
        idTren: "03113",
        estaciones: [
          { p: "00100", h: "10:00", hs: "10:00" },
          { p: "00200", h: "11:00", hs: "11:00" },
        ],
        secuencia: [
          { lat: 40.4, lon: -3.7 },
          { lat: 41.4, lon: -2.7 },
        ],
      },
    ],
  };
  assert.equal(
    normalizeVisor({ trenes: [raw] }, catalog, null, itineraries).trains[0]
      .stops.length,
    2,
  );
  itineraries.trenes[0].estaciones[1].p = "99999";
  assert.equal(
    normalizeVisor({ trenes: [raw] }, catalog, null, itineraries).trains[0]
      .stops.length,
    0,
  );
});
test("Adif HTML extraction preserves source text, page timestamp and unknown per-bulletin date/location", () => {
  const html =
    '<div class="fecha-actualizacion__text">29-10-2026 / <strong>15:43</strong></div><div class="listado-informacion-red-contenedor"><article class="aviso-item" data-article-id="7"><h2 class="aviso-item__ambito">Madrid / Castilla-La Mancha</h2><span class="aviso-card__titulo">Incidencia en catenaria</span><div class="aviso-card__content"><p>Está interrumpida la circulación por falta de tensión.</p><p>Personal trabajando.</p></div></article></div>';
  const parsed = parseAdif(
    html,
    "adif-traffic",
    "https://www.adif.es/viajeros/estado-de-la-red",
    now,
  );
  assert.equal(parsed.incidents[0].category, "Catenaria");
  assert.equal(parsed.incidents[0].severity, "high");
  assert.equal(parsed.incidents[0].start, null);
  assert.equal(parsed.incidents[0].checkedAt, now);
  assert.equal(parsed.incidents[0].lat, undefined);
  assert.ok(parsed.pageTimestamp);
  assert.match(parsed.incidents[0].description, /Personal trabajando/);
});
test("changed HTML/consent or error pages cannot silently become zero incidents", () => {
  assert.throws(() =>
    parseAdif(
      "<html>Error</html>",
      "adif-traffic",
      "https://www.adif.es/viajeros/estado-de-la-red",
      now,
    ),
  );
  assert.equal(
    parseAdif(
      "<main>En este momento no hay incidencias relevantes</main>",
      "adif-traffic",
      "https://www.adif.es/viajeros/estado-de-la-red",
      now,
    ).incidents.length,
    0,
  );
});
test("planned works use full accessible title and only trusted HTTPS Adif article links", () => {
  const html =
    '<div class="avisos-grid"><a class="aviso-card" href="javascript:alert(1)"><span class="sr-only">Leer aviso: Obras completas</span><div class="aviso-card__header">Galicia</div><div class="aviso-card__content">Resumen de obras...</div></a></div>';
  const [incident] = parseAdif(
    html,
    "adif-works",
    "https://www.adif.es/viajeros/avisos",
    now,
  ).incidents;
  assert.equal(incident.title, "Obras completas");
  assert.equal(incident.url, "https://www.adif.es/viajeros/avisos");
  assert.equal(incident.start, null);
  assert.equal(incident.severity, "info");
});
