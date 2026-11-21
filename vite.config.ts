import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the built app works from any path (root, subfolder, or installed).
  base: "./",
  build: {
    rollupOptions: {
      // One page per game, plus the library home at the root.
      input: {
        library: resolve(__dirname, "index.html"),
        dustline: resolve(__dirname, "dustline/index.html"),
        lanternwake: resolve(__dirname, "lanternwake/index.html"),
        petanque: resolve(__dirname, "petanque/index.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Online rooms are served by the FastAPI app (uvicorn on :8000) in development.
    proxy: {
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
