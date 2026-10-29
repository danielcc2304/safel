import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import handler from "./api/network.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
});
