import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, navGroups } from "@/components/tg/app-sidebar";
import { ThemeToggle } from "@/components/tg/theme-toggle";
import { TokenGateProvider } from "@/lib/tokengate/store";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Panel — TokenGate" },
      { name: "description", content: "Panel de control de TokenGate para agentes de compras y pagos." },
      { property: "og:title", content: "Panel — TokenGate" },
      { property: "og:description", content: "Tus agentes operan. Tú mantienes el control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = navGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
  const current = items.filter((i) => (i.url === "/app" ? path.replace(/\/$/, "") === "/app" : path.startsWith(i.url)))[0];

  return (
    <TokenGateProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-background">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur sm:px-4">
              <SidebarTrigger className="h-10 w-10" aria-label="Abrir o cerrar menú lateral" />
              <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                <Link to="/app" className="hidden text-muted-foreground hover:text-foreground sm:inline">{current?.group ?? "General"}</Link>
                <span className="hidden text-muted-foreground sm:inline">/</span>
                <span className="truncate font-medium">{current?.title ?? "Resumen"}</span>
              </nav>
              <span className="hidden items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
                <FlaskConical className="h-3.5 w-3.5" /> Demo · sin pagos reales
              </span>
              <ThemeToggle />
            </header>
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TokenGateProvider>
  );
}
