import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/agentes")({
  component: () => <Navigate to="/app" replace />,
});
