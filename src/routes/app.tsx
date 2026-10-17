import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, navGroups } from "@/components/tg/app-sidebar";
import { ThemeToggle } from "@/components/tg/theme-toggle";
import { TokenGateProvider, useTokenGate } from "@/lib/tokengate/store";
import { formatBase } from "@/lib/tokengate/format";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Panel — blinka" },
      {
        name: "description",
        content: "Agente pagador de blinka: paga, frena o escala cada factura según tus reglas.",
      },
      { property: "og:title", content: "Panel — blinka" },
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
  const current = items.filter((i) =>
    i.url === "/app" ? path.replace(/\/$/, "") === "/app" : path.startsWith(i.url),
  )[0];

  return (
    <TokenGateProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-background">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-2 backdrop-blur-md sm:px-4">
              <SidebarTrigger className="h-10 w-10" aria-label="Abrir o cerrar menú lateral" />
              <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                <Link
                  to="/app"
                  className="hidden text-muted-foreground hover:text-foreground sm:inline"
                >
                  {current?.group ?? "General"}
                </Link>
                <span className="hidden text-muted-foreground sm:inline">/</span>
                <span className="truncate font-medium">{current?.title ?? "Resumen"}</span>
              </nav>
              <HeaderPills />
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

function HeaderPills() {
  const { policy, ledger } = useTokenGate();
  return (
    <span className="hidden items-center gap-2 sm:flex">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        <FlaskConical className="h-3.5 w-3.5" /> Datos simulados
      </span>
      <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        Política <b className="font-mono font-medium text-foreground">{policy.version}</b>
      </span>
      <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
        Disponible <b className="font-mono font-medium">{formatBase(ledger.availableMinor)}</b>
      </span>
    </span>
  );
}
