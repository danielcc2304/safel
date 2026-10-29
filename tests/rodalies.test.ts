import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRodalies, parseRodalies } from "../server/rodalies.ts";
const now = Date.parse("2026-10-29T20:00:00Z") / 1000;
const feed = (items = "") =>
  `<rss><channel><title>Incidencias Rodalies</title><pubDate>Thu, 29 Oct 2026 20:50:00 +0100</pubDate>${items}</channel></rss>`;
const item = `<item><title>Línea R4 · Accidente</title><description>Circulación afectada por un accidente ferroviario &amp; interrupciones.</description><pubDate>Thu, 29 Oct 2026 19:00:00 +0100</pubDate></item>`;

test("official regional RSS preserves source, publication, unknown coordinates and accident priority without inventing national coverage", () => {
  const parsed = parseRodalies(feed(item + item), now);
  assert.equal(parsed.incidents.length, 1);
  const i = parsed.incidents[0];
  assert.equal(i.category, "Accidente");
  assert.equal(i.sourceId, "rodalies-alerts");
  assert.equal(i.start, Date.parse("2026-10-29T18:00:00Z") / 1000);
  assert.deepEqual(i.regions, ["Cataluña"]);
  assert.deepEqual(i.routeIds, []);
  assert.equal(i.lat, undefined);
  assert.equal(i.severity, "info");
});

test("valid empty RSS clears notices, but an error page, missing content or future date never becomes an empty healthy feed", () => {
  assert.equal(parseRodalies(feed(), now).incidents.length, 0);
  assert.throws(() => parseRodalies("<html>Service unavailable</html>", now));
  assert.throws(() =>
    parseRodalies(feed("<item><title>Accidente</title></item>"), now),
  );
  assert.throws(() =>
    parseRodalies(feed(item.replace("2026 19:00", "2027 19:00")), now),
  );
});

test("RSS outage retains original timestamps; recovery to empty removes phantom incidents", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let time = now;
  try {
    Date.now = () => time * 1000;
    globalThis.fetch = async () => new Response(feed(item));
    const first = await fetchRodalies();
    assert.equal(first.source.status, "ok");
    time += 61;
    globalThis.fetch = async () => {
      throw new Error("outage");
    };
    const failed = await fetchRodalies();
    assert.equal(failed.source.status, "stale");
    assert.equal(failed.source.fetchedAt, now);
    assert.equal(failed.incidents[0].checkedAt, now);
    time += 61;
    globalThis.fetch = async () => new Response(feed());
    const recovered = await fetchRodalies();
    assert.equal(recovered.incidents.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
