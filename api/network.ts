import type { IncomingMessage, ServerResponse } from "node:http";
import { getNetwork } from "../server/network.ts";
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=20, stale-while-revalidate=30",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Safel-Region", process.env.VERCEL_REGION || "local");
  res.setHeader(
    "X-Safel-Revision",
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
  );
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ error: "Método no permitido" }));
    return;
  }
  try {
    res.end(JSON.stringify(await getNetwork()));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error: "Las fuentes no están disponibles. Vuelve a intentarlo.",
      }),
    );
  }
}
