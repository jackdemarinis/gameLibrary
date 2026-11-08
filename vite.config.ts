import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs so the built app works from any path (root, subfolder, or installed).
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
