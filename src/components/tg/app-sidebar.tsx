import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Bot,
  SlidersHorizontal,
  Wallet,
  UserCheck,
  ScrollText,
  ShieldCheck,
  Settings,
  ChevronsUpDown,
  Building2,
  FlaskConical,
  LogOut,
  Bell,
  Swords,
  Check,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORGS, ORG_IDS } from "@/lib/tokengate/mock-data";
import { useTokenGate } from "@/lib/tokengate/store";
import { needsAttention } from "@/lib/tokengate/status";
import { Logo, Wordmark } from "./logo";

type Item = { title: string; url: string; icon: typeof FileText; badge?: "attention" | "alerts" };

export const navGroups: { label: string; items: Item[] }[] = [
  {
    label: "General",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard },
      { title: "Facturas", url: "/app/facturas", icon: FileText },
      { title: "Compras", url: "/app/compras", icon: ShoppingCart },
      { title: "Agentes", url: "/app/agentes", icon: Bot },
    ],
  },
  {
    label: "Control financiero",
    items: [
      { title: "Aprobaciones", url: "/app/aprobaciones", icon: UserCheck, badge: "attention" },
      { title: "Políticas de pago", url: "/app/politicas", icon: SlidersHorizontal },
      { title: "Presupuestos", url: "/app/presupuestos", icon: Wallet },
      { title: "Alertas", url: "/app/alertas", icon: Bell, badge: "alerts" },
    ],
  },
  {
    label: "Confianza",
    items: [
      { title: "Registro de decisiones", url: "/app/decisiones", icon: ScrollText },
      { title: "Auditoría", url: "/app/auditoria", icon: ShieldCheck },
      { title: "Red team", url: "/app/red-team", icon: Swords },
    ],
  },
  { label: "Configuración", items: [{ title: "Ajustes", url: "/app/ajustes", icon: Settings }] },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { all, alerts, seed, org, switchOrg } = useTokenGate();
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
          aria-label="Agente pagador, ir al dashboard"
        >
          {collapsed ? <Logo /> : <Wordmark />}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-11 rounded-xl border border-sidebar-border bg-card"
              tooltip={seed.name}
            >
              <Building2 className="h-4 w-4" />
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium text-foreground">{seed.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {seed.jurisdiction} · {seed.period}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Organizaciones de demo</DropdownMenuLabel>
            {ORG_IDS.map((id) => (
              <DropdownMenuItem key={id} onSelect={() => switchOrg(id)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{ORGS[id].name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {id === "andes"
                      ? "Set de prueba LatAm · 5 monedas"
                      : "Datos originales de la rama UX"}
                  </span>
                </span>
                {id === org && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
            <FlaskConical className="h-3.5 w-3.5" /> Datos simulados · sandbox
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
                Ajustes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">
                <LogOut className="h-4 w-4" />
                Salir de la demo
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
