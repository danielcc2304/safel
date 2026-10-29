import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRailNews } from "../server/rail-news.ts";

test("national news respects rate limits and coalesces polls, then retains dates on errors and recovers without phantom stories", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = Date.UTC(2026, 9, 29, 17) / 1000,
    calls = 0,
    phase = "limited";
  const emptyRtve =
    '<h3><a href="/noticias/20261029/actualidad/1.shtml">Actualidad</a></h3>';
  try {
    Date.now = () => now * 1000;
    globalThis.fetch = async (input) => {
      if (!String(input).includes("gdeltproject"))
        return new Response(emptyRtve);
      calls++;
      if (phase === "limited")
        return new Response("Too many requests", {
          status: 429,
          headers: { "retry-after": "1800" },
        });
      if (phase === "failed") throw new Error("outage");
      return Response.json({
        articles:
          phase === "empty"
            ? []
            : [
                {
                  title: "Accidente ferroviario en España",
                  url: "https://example.com/a",
                  seendate: "20261029T170000Z",
                },
              ],
      });
    };
    const first = await Promise.all([fetchRailNews(), fetchRailNews()]);
    assert.equal(calls, 1);
    assert.match(first[0][0].source.error || "", /HTTP 429/);
    assert.equal(first[0][0].source.status, "unavailable");
    assert.equal(first[0][0].source.fetchedAt, null);
    now += 901;
    await fetchRailNews();
    assert.equal(calls, 1);
    now += 901;
    phase = "success";
    const success = (await fetchRailNews())[0];
    assert.equal(calls, 2);
    assert.equal(success.news.length, 1);
    const fetched = success.source.fetchedAt,
      checked = success.news[0].checkedAt;
    now += 901;
    phase = "failed";
    const failed = (await fetchRailNews())[0];
    assert.equal(failed.source.status, "stale");
    assert.equal(failed.source.fetchedAt, fetched);
    assert.equal(failed.news[0].checkedAt, checked);
    now += 901;
    phase = "empty";
    const recovered = (await fetchRailNews())[0];
    assert.equal(recovered.source.status, "ok");
    assert.deepEqual(recovered.news, []);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
