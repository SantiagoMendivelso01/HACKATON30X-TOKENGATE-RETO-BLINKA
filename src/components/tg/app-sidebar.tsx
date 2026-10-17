import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, ShoppingCart, Bot, SlidersHorizontal, Wallet, UserCheck, ScrollText, ShieldCheck, Settings, ChevronsUpDown, Building2, FlaskConical, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ORG_NAME, CURRENT_USER } from "@/lib/tokengate/mock-data";
import { useTokenGate } from "@/lib/tokengate/store";
import { needsAttention } from "@/lib/tokengate/status";
import { Logo } from "./logo";

type Item = { title: string; url: string; icon: typeof FileText; badge?: "attention" };

export const navGroups: { label: string; items: Item[] }[] = [
  { label: "General", items: [
    { title: "Resumen", url: "/app", icon: LayoutDashboard },
    { title: "Facturas", url: "/app/facturas", icon: FileText },
    { title: "Compras", url: "/app/compras", icon: ShoppingCart },
    { title: "Agentes", url: "/app/agentes", icon: Bot },
  ] },
  { label: "Control financiero", items: [
    { title: "Políticas de gasto", url: "/app/politicas", icon: SlidersHorizontal },
    { title: "Presupuestos", url: "/app/presupuestos", icon: Wallet },
    { title: "Aprobaciones", url: "/app/aprobaciones", icon: UserCheck, badge: "attention" },
  ] },
  { label: "Transparencia", items: [
    { title: "Registro de decisiones", url: "/app/decisiones", icon: ScrollText },
    { title: "Auditoría", url: "/app/auditoria", icon: ShieldCheck },
  ] },
  { label: "Configuración", items: [{ title: "Ajustes", url: "/app/ajustes", icon: Settings }] },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { all } = useTokenGate();
  const attention = all.filter((e) => needsAttention(e.status)).length;
  const isActive = (url: string) => (url === "/app" ? path === "/app" || path === "/app/" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <Link to="/app" className="flex h-9 items-center gap-2 rounded-md px-1" aria-label="TokenGate, ir al resumen">
          <Logo />
          {!collapsed && <span className="font-semibold tracking-tight">TokenGate</span>}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-11 border border-sidebar-border bg-background/60" tooltip={ORG_NAME}>
              <Building2 className="h-4 w-4" />
              <span className="flex-1 truncate text-left text-sm font-medium">{ORG_NAME}</span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
            <DropdownMenuItem>{ORG_NAME}</DropdownMenuItem>
            <DropdownMenuItem disabled>Añadir organización (no disponible en demo)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="h-10 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground md:h-9"
                    >
                      <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && attention > 0 && <SidebarMenuBadge className="tabular">{attention}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2 py-1.5 text-xs text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" /> Entorno de demostración
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-12" tooltip={CURRENT_USER}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">LG</span>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{CURRENT_USER}</span>
                <span className="truncate text-xs text-muted-foreground">Responsable financiera</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild><Link to="/app/ajustes"><Settings className="h-4 w-4" />Ajustes</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/"><LogOut className="h-4 w-4" />Salir de la demo</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
