import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import handler from "./api/network.ts";
import { adsTxt, validPublisher } from "./src/lib/advertising.ts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const client = env.VITE_ADSENSE_CLIENT?.trim() || "";
  const sellers = adsTxt(client);
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "safel-advertising-config",
        transformIndexHtml() {
          return validPublisher(client)
            ? [
                {
                  tag: "meta",
                  attrs: { name: "google-adsense-account", content: client },
                  injectTo: "head" as const,
                },
              ]
            : [];
        },
        generateBundle() {
          if (sellers)
            this.emitFile({
              type: "asset",
              fileName: "ads.txt",
              source: sellers,
            });
        },
        configureServer(server) {
          server.middlewares.use("/ads.txt", (_req, res) => {
            res.statusCode = sellers ? 200 : 404;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(
              sellers || "# Safel: editor publicitario sin configurar.\n",
            );
          });
        },
      },
      {
        name: "safel-public-data",
        configureServer(server) {
          server.middlewares.use("/api/network", (req, res) => {
            void handler(req, res);
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use("/api/network", (req, res) => {
            void handler(req, res);
          });
        },
      },
    ],
  };
});
