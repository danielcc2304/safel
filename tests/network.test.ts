import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getNetwork,
  normalizeAlerts,
  normalizeTrains,
  parseCsv,
} from "../server/network.ts";

const now = Math.floor(Date.now() / 1000);
const position = (
  tripId = "trip-today",
  id = "03113",
  coords: object | null = { latitude: 40.4, longitude: -3.7 },
) => ({
  id: `VP_${id}`,
  vehicle: {
    trip: { tripId },
    position: coords,
    vehicle: { id, label: id },
    currentStatus: "IN_TRANSIT_TO",
    stopId: "60000",
  },
});
const feed = (entity: object[]) => ({
  header: { timestamp: String(now) },
  entity,
});
test("GTFS CSV supports BOM, padded fields, quoted commas, escaped quotes and multiline content", () => {
  const rows = parseCsv(
    '\uFEFFid,name,note  \r\n1,"Madrid, Atocha","dice ""hola"""  \r\n2,Barcelona,"línea\nsegunda"\r\n',
  );
  assert.deepEqual(rows, [
    { id: "1", name: "Madrid, Atocha", note: 'dice "hola"' },
    { id: "2", name: "Barcelona", note: "línea\nsegunda" },
  ]);
});
test("unpublished GPS never becomes a train at 0,0", () => {
  const trains = normalizeTrains(
    feed([
      position("missing", "a", null),
      position("zero", "b", { latitude: 0, longitude: 0 }),
      position("valid", "c"),
    ]),
    null,
    "positions-ld",
    null,
  );
  assert.equal(trains.length, 1);
  assert.equal(trains[0].number, "c");
});
test("missing delay and route metadata remain unknown rather than on time or inferred", () => {
  const [train] = normalizeTrains(
    feed([position()]),
    null,
    "positions-ld",
    null,
  );
  assert.equal(train.delay, null);
  assert.equal(train.origin, undefined);
  assert.equal(train.service, "Sin clasificar");
  assert.deepEqual(train.stops, []);
});
test("delays join only by exact trip ID; a different service date is never joined by train number", () => {
  const updates = feed([
    { tripUpdate: { trip: { tripId: "trip-yesterday" }, delay: 900 } },
  ]);
  const [train] = normalizeTrains(
    feed([position("trip-today")]),
    updates,
    "positions-ld",
    null,
  );
  assert.equal(train.delay, null);
});
test("zero delay remains a valid value and canceled services retain their explicit state", () => {
  const updates = feed([
    {
      trip_update: {
        trip: { trip_id: "trip-today", schedule_relationship: "CANCELED" },
        delay: 0,
      },
    },
  ]);
  const [train] = normalizeTrains(
    feed([position()]),
    updates,
    "positions-ld",
    null,
  );
  assert.equal(train.delay, 0);
  assert.equal(train.canceled, true);
  assert.equal(train.delayStale, false);
});
test("old delay snapshots are flagged instead of presented as current", () => {
  const updates = {
    header: { timestamp: now - 1000 },
    entity: [{ tripUpdate: { trip: { tripId: "trip-today" }, delay: 600 } }],
  };
  const [train] = normalizeTrains(
    feed([position()]),
    updates,
    "positions-ld",
    null,
  );
  assert.equal(train.delay, 10);
  assert.equal(train.delayStale, true);
  assert.equal(train.delayTimestamp, now - 1000);
});
test("vehicle numbers with multiple service dates are displayed once, preferring today", () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const trains = normalizeTrains(
    feed([position("0311312020-01-01"), position(`031131${today}`)]),
    null,
    "positions-ld",
    null,
  );
  assert.equal(trains.length, 1);
  assert.equal(trains[0].tripId, `031131${today}`);
});
test("ended alerts are excluded; old open-ended notices retain their original dates", () => {
  const alert = (id: string, end?: number) => ({
    id,
    alert: {
      activePeriod: [{ start: now - 10000, ...(end ? { end } : {}) }],
      descriptionText: {
        translation: [{ text: "Aviso de circulación", language: "es" }],
      },
    },
  });
  const alerts = normalizeAlerts(
    feed([alert("ended", now - 100), alert("open")]),
    null,
    now,
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, "open");
  assert.equal(alerts[0].start, now - 10000);
});
test("severity is not guessed from alarming words when GTFS gives no explicit effect", () => {
  const alerts = normalizeAlerts(
    feed([
      {
        id: "1",
        alert: {
          descriptionText: {
            translation: [
              { language: "es", text: "Incidencia grave en la catenaria" },
            ],
          },
        },
      },
    ]),
    null,
  );
  assert.equal(alerts[0].category, "Catenaria");
  assert.equal(alerts[0].severity, "info");
});
test("explicit GTFS effects and translated descriptions are preserved", () => {
  const alerts = normalizeAlerts(
    feed([
      {
        id: "1",
        alert: {
          effect: "NO_SERVICE",
          description_text: {
            translation: [
              { language: "en", text: "Works" },
              { language: "es", text: "Servicio interrumpido por obras" },
            ],
          },
          informed_entity: [{ route_id: "route-1" }],
        },
      },
    ]),
    null,
  );
  assert.equal(alerts[0].severity, "high");
  assert.equal(alerts[0].description, "Servicio interrumpido por obras");
  assert.deepEqual(alerts[0].routeIds, ["route-1"]);
});
test("an upstream outage returns explicit unavailable sources and never fabricated trains", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Simulated upstream outage");
  };
  try {
    const data = await getNetwork();
    assert.equal(data.demo, false);
    assert.deepEqual(data.trains, []);
    assert.deepEqual(data.incidents, []);
    assert.deepEqual(data.railNews, []);
    assert.equal(data.sources.length, 14);
    assert.ok(data.sources.every((s) => s.status === "unavailable"));
    assert.ok(data.sources.every((s) => s.timestamp === null));
  } finally {
    globalThis.fetch = original;
  }
});
