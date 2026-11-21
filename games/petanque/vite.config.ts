import { defineConfig } from "vite";

// Online rooms are served by the FastAPI app at the repo root (uvicorn on :8000).
// Both the dev server and `vite preview` forward /ws to it; without uvicorn running,
// Host/Join report it clearly.
const roomProxy = {
  "/ws": { target: "ws://localhost:8000", ws: true },
};

// Self-contained game: builds to ./dist, which scripts/buildAll.py copies to /petanque/ on the site.
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5176, strictPort: true, proxy: roomProxy },
  preview: { host: "0.0.0.0", port: 4176, proxy: roomProxy },
});
