import assert from "node:assert/strict";
import { test } from "node:test";
import {
  relevantRailNews,
  parseGdelt,
  parseRtveArticle,
  rtveCandidates,
  canonicalNewsUrl,
  deduplicateNews,
} from "../server/rail-news.ts";
const now = Date.UTC(2026, 9, 29, 17, 0, 0) / 1000;
const article = {
  title: "Accidente ferroviario en España: choque entre dos trenes",
  url: "https://example.com/accidente?utm_source=test",
  seendate: "20261029T160000Z",
};

test("national rail news requires accident, railway and Spanish scope; rejects road, foreign and historical headlines", () => {
  for (const title of [
    "Accidente ferroviario en España",
    "Descarrila un tren en Toledo",
    "Train collision in Spain",
    "Colisión de dos trenes en Jaén",
  ])
    assert.equal(relevantRailNews(title), true, title);
  for (const title of [
    "Accidente de tráfico en Madrid",
    "Train collision in India",
    "Un tren accidentado en Francia: reacciones en España",
    "Aniversario del accidente de tren en España",
    "Simulacro de accidente ferroviario en Madrid",
    "Descarrila un tren",
    "Sin accidentes ferroviarios en España",
  ])
    assert.equal(relevantRailNews(title), false, title);
});
test("GDELT preserves indexing time as indexing, never publication or accident date; deduplicates URLs", () => {
  const news = parseGdelt(
    {
      articles: [
        article,
        { ...article, url: "https://example.com/accidente#fragment" },
      ],
    },
    now,
  );
  assert.equal(news.length, 1);
  assert.equal(news[0].url, "https://example.com/accidente");
  assert.equal(news[0].publishedAt, null);
  assert.equal(news[0].indexedAt, now - 3600);
  assert.equal(news[0].checkedAt, now);
  assert.equal(news[0].outlet, "example.com");
});
test("invalid payloads fail instead of becoming clean empty news; old, future and unsafe links are excluded", () => {
  assert.throws(() => parseGdelt({ error: "rate limited" }, now));
  assert.throws(() => parseGdelt(null, now));
  for (const override of [
    { seendate: "20261020T160000Z" },
    { seendate: "20261030T160000Z" },
    { seendate: "20260230T160000Z" },
    { url: "javascript:alert(1)" },
    { url: "https://user:secret@example.com/a" },
  ])
    assert.deepEqual(
      parseGdelt({ articles: [{ ...article, ...override }] }, now),
      [],
    );
  assert.equal(
    canonicalNewsUrl("https://a.com/x?key=value&utm_source=tracking#hash"),
    "https://a.com/x?key=value",
  );
});
test("RTVE discovery only follows numeric news IDs on the trusted official host", () => {
  assert.deepEqual(
    rtveCandidates(
      '<h3><a href="https://www.rtve.es/noticias/20261029/accidente-tren/123.shtml">Accidente de tren en Toledo</a></h3><h3><a href="https://evil.test/noticias/20261029/accidente/456.shtml">Accidente de tren</a></h3>',
    ),
    ["123"],
  );
  assert.throws(() => rtveCandidates("<main>Blocked</main>"));
  assert.deepEqual(
    rtveCandidates(
      '<h3><a href="/noticias/20261029/actualidad/321.shtml">Actualidad</a></h3>',
    ),
    [],
  );
});
test("RTVE news uses actual publication timestamp and domestic metadata, with no invented coordinates or operational incidents", () => {
  const a = {
    title: "Colisión entre dos trenes",
    htmlUrl: "https://www.rtve.es/noticias/20261029/colision/123.shtml",
    publicationDateTimestamp: (now - 1800) * 1000,
    mainCategory: "Noticias/España/Andalucía",
  };
  const news = parseRtveArticle({ page: { items: [a] } }, now);
  assert.equal(news.length, 1);
  assert.equal(news[0].publishedAt, now - 1800);
  assert.equal(news[0].indexedAt, null);
  assert.equal("lat" in news[0], false);
  for (const override of [
    { publicationDateTimestamp: null },
    { publicationDateTimestamp: (now + 3600) * 1000 },
    { mainCategory: "Noticias/Mundo" },
    { htmlUrl: "https://evil.test/noticia" },
  ])
    assert.deepEqual(
      parseRtveArticle({ page: { items: [{ ...a, ...override }] } }, now),
      [],
    );
  assert.throws(() => parseRtveArticle({}, now));
  const viaGdelt = {
    ...news[0],
    id: "gdelt",
    sourceId: "rail-news-gdelt",
    publishedAt: null,
    indexedAt: now,
  };
  assert.equal(deduplicateNews([viaGdelt, ...news])[0].publishedAt, now - 1800);
});
