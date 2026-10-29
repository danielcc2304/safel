import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchAdif } from "../server/adif.ts";
test("failed accident polls retain the last bulletin with its original date and stale status; successful empty polls do not keep phantom bulletins", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let time = 2000;
  const empty = "<main>En este momento no hay incidencias relevantes</main>";
  const banner =
    '<div class="adif-aviso-wrapper"><h1 class="adif-titulo-aviso">Accidente en la red</h1><div class="adif-aviso-contenido"><p>Comunicado de accidente.</p></div></div>';
  try {
    Date.now = () => time * 1000;
    globalThis.fetch = async (input) =>
      new Response(
        String(input).includes("estado-de-la-red") ? banner + empty : empty,
      );
    const first = (await fetchAdif()).find(
      (s) => s.source.id === "adif-traffic",
    )!;
    assert.equal(first.source.status, "ok");
    assert.equal(first.incidents.length, 1);
    time += 61;
    globalThis.fetch = async () => {
      throw new Error("outage");
    };
    const failed = (await fetchAdif()).find(
      (s) => s.source.id === "adif-traffic",
    )!;
    assert.equal(failed.source.status, "stale");
    assert.equal(failed.source.fetchedAt, 2000);
    assert.equal(failed.incidents[0].checkedAt, 2000);
    time += 61;
    globalThis.fetch = async () => new Response(empty);
    const recovered = (await fetchAdif()).find(
      (s) => s.source.id === "adif-traffic",
    )!;
    assert.equal(recovered.source.status, "ok");
    assert.equal(recovered.incidents.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
