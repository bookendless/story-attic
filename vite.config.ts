import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  // Tauriが期待するポート
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rustソースの変更を監視対象から除外
      ignored: ["**/src-tauri/**"],
    },
  },
  // Viteのビルド出力先（Tauriが参照）
  build: {
    outDir: "dist",
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
