import { defineConfig } from "vite";

// The site shell: home page, icons, manifest and service worker. Builds to ./dist,
// which scripts/buildAll.py uses as the site root before adding each game's folder.
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
});
