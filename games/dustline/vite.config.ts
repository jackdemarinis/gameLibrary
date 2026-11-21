import { defineConfig } from "vite";

// Self-contained game: builds to ./dist, which scripts/buildAll.py copies to /dustline/ on the site.
export default defineConfig({
  // Relative asset URLs so the build works from any folder.
  base: "./",
  server: { host: "0.0.0.0", port: 5174, strictPort: true },
});
