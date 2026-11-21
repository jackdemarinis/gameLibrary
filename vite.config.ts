import { resolve } from "node:path";
import { defineConfig } from "vite";

const roomProxy = {
  "/ws": { target: "ws://localhost:8000", ws: true },
};

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
  // Online rooms are served by the FastAPI app (uvicorn on :8000) locally.
  // Both the dev server and `vite preview` forward /ws to it, so online play
  // works on either; without uvicorn running, Host/Join report it clearly.
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: roomProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: roomProxy,
  },
});
