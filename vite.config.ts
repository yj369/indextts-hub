import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @ts-expect-error process is a nodejs global
const tauriHost = process.env.TAURI_DEV_HOST;
const effectiveHost = tauriHost ?? "127.0.0.1";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: effectiveHost,
    hmr: tauriHost
      ? {
          protocol: "ws",
          host: tauriHost,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
