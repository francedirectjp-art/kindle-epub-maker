import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages のプロジェクトページ配信用にベースパスを合わせる
export default defineConfig({
  base: "/kindle-epub-maker/",
  plugins: [react()],
});
