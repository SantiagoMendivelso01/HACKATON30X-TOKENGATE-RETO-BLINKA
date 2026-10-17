import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/politicas")({
  component: () => <Navigate to="/app/ajustes" replace />,
});
