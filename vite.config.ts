import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: { port: 5180 },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts envuelve el handler SSR para mostrar una página de error legible.
      server: { entry: "server" },
      // Nada de código de servidor en el bundle del navegador.
      importProtection: { behavior: "error", client: { files: ["**/server/**"] } },
    }),
    // Build para Node: `npm run build` genera .output/ y `npm start` lo sirve.
    nitro(),
    viteReact(),
  ],
});
