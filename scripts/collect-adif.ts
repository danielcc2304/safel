import { appendFile } from "node:fs/promises";
import { fetchAdif } from "../server/adif.ts";
import {
  fetchAdifSnapshot,
  snapshotRecord,
  parseAdifSnapshot,
  type AdifSnapshot,
} from "../server/adif-snapshot.ts";

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (repository !== "danielcc2304/safel" || !token)
  throw new Error(
    "El recolector solo publica en el repositorio de Safel con GITHUB_TOKEN.",
  );
const now = Math.floor(Date.now() / 1000);
const [current, previous] = await Promise.all([
  fetchAdif({ allowSnapshot: false }),
  fetchAdifSnapshot(),
]);
const records = current.map((record) => {
  if (record.source.fetchedAt)
    return { source: record.source, incidents: record.incidents };
  const old = previous ? snapshotRecord(previous, record.source.id, now) : null;
  return old
    ? {
        incidents: old.incidents,
        source: {
          ...old.source,
          status: "stale" as const,
          error: record.source.error,
        },
      }
    : { source: record.source, incidents: record.incidents };
});
const snapshot: AdifSnapshot = parseAdifSnapshot(
  { version: 1, generatedAt: now, records },
  now,
);
const api = async (path: string, method = "GET", body?: unknown) => {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${path}`,
    {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (response.status === 404 && method === "GET") return null;
  if (!response.ok)
    throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.json();
};
const ref = await api("git/ref/heads/rail-data");
const tree = await api("git/trees", "POST", {
  tree: [
    {
      path: "adif.json",
      mode: "100644",
      type: "blob",
      content: JSON.stringify(snapshot),
    },
    {
      path: "vercel.json",
      mode: "100644",
      type: "blob",
      content: JSON.stringify({ git: { deploymentEnabled: false } }),
    },
  ],
});
const commit = await api("git/commits", "POST", {
  message: "Actualiza boletines públicos de Adif",
  tree: tree.sha,
  parents: ref ? [ref.object.sha] : [],
});
if (ref) await api("git/refs/heads/rail-data", "PATCH", { sha: commit.sha });
else
  await api("git/refs", "POST", {
    ref: "refs/heads/rail-data",
    sha: commit.sha,
  });
const lines = records.map(
  (r) =>
    `- ${r.source.id}: ${r.source.status}; descarga ${r.source.fetchedAt ? new Date(r.source.fetchedAt * 1000).toISOString() : "no disponible"}; ${r.incidents.length} comunicados${r.source.error ? `; ${r.source.error}` : ""}`,
);
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
if (current.some((r) => !r.source.fetchedAt)) process.exitCode = 1;
