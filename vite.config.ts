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
    // WebView2 (Windows) はエバーグリーン Chromium のため chrome110 を下限とする。
    // safari13 を含めると esbuild は最も古いターゲットに合わせて全構文を
    // ダウントランスパイルするため除外（macOS 配布を始める際は要再検討）
    target: ["es2022", "chrome110"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
