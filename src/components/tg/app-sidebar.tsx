import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  UserCheck,
  ShieldCheck,
  Settings,
  Building2,
  FlaskConical,
  LogOut,
  Waypoints,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTokenGate } from "@/lib/tokengate/store";
import { needsAttention } from "@/lib/tokengate/status";
import { Logo, Wordmark } from "./logo";

type Item = { title: string; url: string; icon: typeof FileText; badge?: "attention" | "alerts" };

export const navGroups: { label: string; items: Item[] }[] = [
  {
    label: "Operación",
    items: [
      { title: "Resumen", url: "/app", icon: LayoutDashboard },
      { title: "Cómo funciona", url: "/app/como-funciona", icon: Waypoints },
      { title: "Facturas", url: "/app/facturas", icon: FileText },
      { title: "Por aprobar", url: "/app/aprobaciones", icon: UserCheck, badge: "attention" },
    ],
  },
  {
    label: "Control y Confianza",
    items: [
      { title: "Presupuesto", url: "/app/presupuestos", icon: Wallet },
      {
        title: "Auditoría y Decisiones",
        url: "/app/auditoria",
        icon: ShieldCheck,
        badge: "alerts",
      },
    ],
  },
  {
    label: "Configuración",
    items: [{ title: "Reglas y Ajustes", url: "/app/ajustes", icon: Settings }],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { all, alerts, seed } = useTokenGate();
  const attention = all.filter((e) => needsAttention(e.status)).length;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const isActive = (url: string) =>
    url === "/app" ? path === "/app" || path === "/app/" : path.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <Link
          to="/app"
          className="flex h-9 items-center gap-2 rounded-md px-1"
          aria-label="Agente pagador, ir al resumen"
        >
          {collapsed ? <Logo /> : <Wordmark />}
        </Link>
        <SidebarMenuButton
          asChild
          className="h-11 rounded-xl border border-sidebar-border bg-card"
          tooltip={seed.name}
        >
          <Link to="/app/ajustes">
            <Building2 className="h-4 w-4" />
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="truncate text-sm font-medium text-foreground">{seed.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {seed.jurisdiction} · {seed.period}
              </span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-[0.1em]">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const n =
                    item.badge === "attention"
                      ? attention
                      : item.badge === "alerts"
                        ? alerts.length
                        : 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        className="h-10 rounded-xl border border-transparent font-medium data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm md:h-9"
                      >
                        <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {n > 0 && (
                        <SidebarMenuBadge
                          className={`tabular rounded-full font-mono text-[11px] ${item.badge === "alerts" && critical ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}
                        >
                          {n}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-sidebar-border px-2 py-1.5 text-xs text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" /> Pagos en sandbox
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-12 rounded-xl" tooltip={seed.user.name}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {seed.user.initials}
              </span>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium text-foreground">
                  {seed.user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{seed.user.role}</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/app/ajustes">
                <Settings className="h-4 w-4" />
                Reglas y Ajustes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
