import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, FlaskConical } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, navGroups } from "@/components/tg/app-sidebar";
import { ThemeToggle } from "@/components/tg/theme-toggle";
import { TokenGateProvider, useTokenGate } from "@/lib/tokengate/store";
import { loadOrgState } from "@/lib/tokengate/db.functions";
import { formatBase } from "@/lib/tokengate/format";
import { getSimUser } from "@/lib/tokengate/sim-auth";
import { Button } from "@/components/ui/button";

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
  // Load once: the store keeps the state from then on, so child navigation never reloads it.
  loader: () => loadOrgState(),
  shouldReload: false,
  component: AppLayout,
});

function AppLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const items = navGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
  const current = items.filter((i) =>
    i.url === "/app" ? path.replace(/\/$/, "") === "/app" : path.startsWith(i.url),
  )[0];
  const loaded = Route.useLoaderData();

  // Sesión simulada: vive en localStorage, así que solo se verifica en el navegador.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    const ok = getSimUser() !== null;
    setHasSession(ok);
    setSessionChecked(true);
    if (!ok) navigate({ to: "/login", replace: true });
  }, [navigate]);

  if (!loaded.ok) return <StorageError message={loaded.error} />;
  if (!sessionChecked || !hasSession) {
    return <div className="min-h-screen bg-background" aria-label="Verificando sesión" />;
  }

  return (
    <TokenGateProvider rows={loaded.rows} mode={loaded.mode}>
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
              <div key={path} className="page-enter">
                <Outlet />
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TokenGateProvider>
  );
}

function StorageError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Base de datos</p>
        <h1 className="display mt-3 text-3xl text-foreground">No se pudieron cargar los datos</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6">
          <Button
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  );
}

function HeaderPills() {
  const { policy, ledger, mode } = useTokenGate();
  return (
    <span className="hidden items-center gap-2 sm:flex">
      <span
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
        title={
          mode === "readonly"
            ? "Datos reales anonimizados. Los cambios son simulados y no alteran los originales."
            : "Los cambios se pierden al recargar."
        }
      >
        <Database className="h-3.5 w-3.5" />{" "}
        {mode === "readonly" ? "Datos anonimizados" : "Sin guardar"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        <FlaskConical className="h-3.5 w-3.5" /> Pagos en sandbox
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
