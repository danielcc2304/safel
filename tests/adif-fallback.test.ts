import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchAdif } from "../server/adif.ts";
import { ADIF_SNAPSHOT_URL } from "../server/adif-snapshot.ts";

test("Vercel rejection recovers one shared persistent copy; new direct empty results supersede cached accidents", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 2000,
    copies = 0;
  try {
    Date.now = () => now * 1000;
    globalThis.fetch = async (input) => {
      if (String(input) !== ADIF_SNAPSHOT_URL)
        return new Response("Denied", { status: 403 });
      copies++;
      return Response.json({
        version: 1,
        generatedAt: 1950,
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
                    description: "Comunicado",
                    category: "Accidente",
                    severity: "info",
                    location: "Sin ubicación",
                    start: null,
                    checkedAt: 1900,
                    url: "https://www.adif.es/viajeros/estado-de-la-red",
                    routeIds: [],
                    stopIds: [],
                  },
                ],
        })),
      });
    };
    const recovered = await fetchAdif();
    assert.equal(copies, 1);
    assert.equal(recovered[0].source.delivery, "snapshot");
    assert.equal(recovered[0].source.fetchedAt, 1900);
    assert.equal(recovered[0].incidents.length, 1);
    assert.equal(recovered[1].incidents.length, 0);
    now += 1000;
    const old = await fetchAdif();
    assert.equal(old[0].source.status, "stale");
    assert.equal(old[0].source.fetchedAt, 1900);
    now += 301;
    globalThis.fetch = async () =>
      new Response(
        "<main>En este momento no hay incidencias relevantes</main>",
      );
    const direct = await fetchAdif();
    assert.ok(
      direct.every(
        (r) => r.incidents.length === 0 && r.source.delivery === "direct",
      ),
    );
    assert.equal(direct[0].source.fetchedAt, now);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
