import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdifSnapshot, snapshotRecord } from "../server/adif-snapshot.ts";

const fixture = () => ({
  version: 1,
  generatedAt: 2000,
  records: ["traffic", "works"].map((kind) => ({
    source: {
      id: `adif-${kind}`,
      name: "Adif",
      url: `https://www.adif.es/viajeros/${kind === "traffic" ? "estado-de-la-red" : "avisos"}`,
      status: "ok",
      timestamp: null,
      fetchedAt: 1900,
      cadence: "5 min",
      scope: "Boletines públicos",
    },
    incidents:
      kind === "works"
        ? []
        : [
            {
              id: "adif-traffic-1",
              sourceId: "adif-traffic",
              title: "Accidente",
              description: "Comunicado de accidente",
              category: "Accidente",
              severity: "info",
              location: "Ámbito no publicado",
              start: null,
              checkedAt: 1900,
              url: "https://www.adif.es/viajeros/estado-de-la-red",
              routeIds: [],
              stopIds: [],
            },
          ],
  })),
});

test("snapshot preserves original dates, accepts a valid empty bulletin and expires without manufacturing freshness", () => {
  const parsed = parseAdifSnapshot(fixture(), 2100);
  const fresh = snapshotRecord(parsed, "adif-traffic", 2100)!;
  assert.equal(fresh.source.delivery, "snapshot");
  assert.equal(fresh.source.status, "ok");
  assert.equal(fresh.source.fetchedAt, 1900);
  assert.equal(fresh.incidents[0].checkedAt, 1900);
  assert.equal(fresh.incidents[0].start, null);
  assert.equal(snapshotRecord(parsed, "adif-works", 2100)!.incidents.length, 0);
  assert.equal(
    snapshotRecord(parsed, "adif-traffic", 2900)!.source.status,
    "stale",
  );
  assert.equal(snapshotRecord(parsed, "adif-traffic", 90000), null);
});

test("snapshot rejects future or expired envelopes, invalid origin, forged dates and missing bulletins", () => {
  for (const mutate of [
    (d: any) => {
      d.generatedAt = 3000;
    },
    (d: any) => {
      d.records[0].source.url = "https://evil.example";
    },
    (d: any) => {
      d.records[0].incidents[0].url = "javascript:alert(1)";
    },
    (d: any) => {
      d.records[0].incidents[0].checkedAt = 2500;
    },
    (d: any) => {
      d.records[0].source.fetchedAt = null;
    },
    (d: any) => {
      d.records[0].source.fetchedAt = 2500;
    },
    (d: any) => {
      d.records.pop();
    },
    (d: any) => {
      d.records[1] = d.records[0];
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => parseAdifSnapshot(value, 2100));
  }
  assert.throws(() => parseAdifSnapshot(fixture(), 90000));
});

test("snapshot strips arbitrary payload fields and never promotes a partial origin to healthy", () => {
  const value = fixture();
  value.records[0].source.status = "stale";
  Object.assign(value.records[0].incidents[0], {
    lat: 0,
    lon: 0,
    end: 2100,
    injected: "ignored",
  });
  const record = snapshotRecord(
    parseAdifSnapshot(value, 2100),
    "adif-traffic",
    2100,
  )!;
  assert.equal(record.source.status, "stale");
  assert.equal(record.incidents[0].lat, undefined);
  assert.equal(record.incidents[0].end, undefined);
});
