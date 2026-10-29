import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MotionHistory,
  motionBetween,
  parseMadridDate,
} from "../server/telemetry.ts";
import { normalizeTrains } from "../server/network.ts";
import type { Train } from "../src/types.ts";

const now = 1793289000;
function sample(timestamp: number, lon = -3.7): Train {
  return {
    id: "test",
    number: "03113",
    name: "AVE",
    service: "Alta velocidad",
    tripId: "same-trip",
    lat: 40.4,
    lon,
    delay: null,
    status: "UNKNOWN",
    timestamp,
    positionTimestampKind: "vehicle",
    sourceId: "visor-ld",
    stops: [],
    speedKmh: null,
    speedKind: "unavailable",
  };
}
test("Madrid local timestamps respect winter and summer offsets", () => {
  assert.equal(
    parseMadridDate("2026-10-29T16:30:00"),
    Date.parse("2026-10-29T15:30:00Z") / 1000,
  );
  assert.equal(
    parseMadridDate("2026-07-29T16:30:00"),
    Date.parse("2026-07-29T14:30:00Z") / 1000,
  );
  assert.equal(
    parseMadridDate("2026-10-29T16:30:00+01:00"),
    Date.parse("2026-10-29T15:30:00Z") / 1000,
  );
});
test("ambiguous DST, missing dates and nonexistent local times stay unknown", () => {
  assert.equal(parseMadridDate("2026-10-25T02:30:00"), null);
  assert.equal(parseMadridDate("2026-03-29T02:30:00"), null);
  assert.equal(parseMadridDate("2026-02-30T12:00:00"), null);
  assert.equal(parseMadridDate(undefined), null);
});
test("two recent observations yield a labelled average, not an instantaneous speed", () => {
  const history = new MotionHistory();
  const first = history.apply([sample(now - 20)], now - 20)[0];
  assert.equal(first.speedKmh, null);
  const next = history.apply([sample(now, -3.69)], now)[0];
  assert.equal(next.speedKind, "estimated");
  assert.equal(next.speedWindowSeconds, 20);
  assert.ok(next.speedKmh! > 100 && next.speedKmh! < 200);
  assert.ok(next.bearing! > 89 && next.bearing! < 91);
});
test("repeated query of the same observation preserves the average without manufacturing movement", () => {
  const history = new MotionHistory();
  history.apply([sample(now - 20)], now - 20);
  const first = history.apply([sample(now, -3.69)], now)[0];
  const duplicate = history.apply([sample(now, -3.69)], now + 10)[0];
  assert.equal(duplicate.speedKmh, first.speedKmh);
  assert.equal(duplicate.speedWindowSeconds, 20);
  assert.equal(duplicate.bearing, first.bearing);
  assert.equal(
    history.apply([sample(now, -3.69)], now + 121)[0].speedKmh,
    null,
  );
});
test("feed timestamp alone never produces a speed estimate", () => {
  assert.equal(
    motionBetween(
      { ...sample(now - 20), positionTimestampKind: "feed" },
      sample(now, -3.69),
      now,
    ),
    null,
  );
});
test("GPS jumps, service changes, stale observations, reversed time and large gaps are rejected", () => {
  assert.equal(
    motionBetween(sample(now - 20), { ...sample(now), lon: 2.1 }, now),
    null,
  );
  assert.equal(
    motionBetween(
      sample(now - 20),
      { ...sample(now, -3.69), tripId: "new-trip" },
      now,
    ),
    null,
  );
  assert.equal(
    motionBetween(sample(now - 500), sample(now - 400, -3.69), now),
    null,
  );
  assert.equal(motionBetween(sample(now), sample(now - 20), now), null);
  assert.equal(motionBetween(sample(now - 181), sample(now, -3.69), now), null);
});
test("GTFS native speed is m/s, zero and north bearing remain valid, and platform is parsed only from explicit label", () => {
  const feed = {
    header: { timestamp: now },
    entity: [
      {
        id: "1",
        vehicle: {
          trip: { tripId: "trip" },
          vehicle: { id: "12", label: "C1-12-PLATF.(3)" },
          position: {
            latitude: 40.4,
            longitude: -3.7,
            speed: 10,
            bearing: 0,
            odometer: 12000,
          },
          timestamp: now,
        },
      },
    ],
  };
  const [train] = normalizeTrains(feed, null, "positions-cerc", null);
  assert.equal(train.speedKmh, 36);
  assert.equal(train.speedKind, "reported");
  assert.equal(train.bearing, 0);
  assert.equal(train.platform, "3");
  assert.equal(train.odometerKm, 12);
  feed.entity[0].vehicle.position.speed = 0;
  assert.equal(
    normalizeTrains(feed, null, "positions-cerc", null)[0].speedKmh,
    0,
  );
});
