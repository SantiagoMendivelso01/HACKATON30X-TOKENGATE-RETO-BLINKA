import { createFileRoute, redirect } from "@tanstack/react-router";

// «Registro de decisiones» vivía aquí, pero duplicaba la pestaña
// «Por qué decidió» de Auditoría. Ahora la ruta redirige conservando
// la búsqueda (?q=…), que ya contiene ese registro.
export const Route = createFileRoute("/app/decisiones")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/app/auditoria",
      search: { tab: "decisiones", q: search.q },
    });
  },
});
