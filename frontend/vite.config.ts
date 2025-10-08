import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: "./index.html",
      },
      outDir: "dist",
    },
    server: {
      port: isDev ? 5173 : 5174,
      host: true,
      open: false,
      strictPort: true,
    },
    preview: {
      port: 5174,
      host: true,
      open: false,
      strictPort: true,
    }
  };
});
