import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;
const appVersion =
  process.env.APP_VERSION ??
  (() => {
    try {
      return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" })
        .trim()
        .replace(/^v/, "");
    } catch {
      return "0.0.0";
    }
  })();

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-framer": ["framer-motion"],
          "vendor-markdown": ["react-markdown", "rehype-highlight", "remark-gfm", "highlight.js"],
          "vendor-lucide": ["lucide-react"],
          "vendor-tanstack": ["@tanstack/react-virtual"],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  optimizeDeps: {
    exclude: ["@tailwindcss/oxide", "@tailwindcss/oxide-win32-x64-msvc"],
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/jan/**", "**/node_modules/**", "**/dist/**", "**/src-tauri/**"],
  },
}));
