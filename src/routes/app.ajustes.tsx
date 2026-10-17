import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/tg/primitives";
import { useThemeState } from "@/components/tg/theme-toggle";
import { useTokenGate } from "@/lib/tokengate/store";

export const Route = createFileRoute("/app/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — blinka" },
      {
        name: "description",
        content: "Organización, moneda, tema, notificaciones y entorno de demostración.",
      },
      { property: "og:title", content: "Ajustes — blinka" },
      { property: "og:description", content: "Configura el agente pagador para tu organización." },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  const { logEvent, seed } = useTokenGate();
  const ORG_NAME = seed.name;
  const CURRENT_USER = seed.user.name;
  const [theme, setTheme] = useThemeState();
  const [org, setOrg] = useState(ORG_NAME);
  const [currency, setCurrency] = useState("COP");
  const [orgError, setOrgError] = useState("");
  const [notif, setNotif] = useState({ approvals: true, blocked: true, weekly: false });

  const save = () => {
    if (org.trim().length < 2) {
      setOrgError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setOrgError("");
    logEvent({
      type: "settings",
      actor: CURRENT_USER,
      actorKind: "human",
      summary: "Ajustes de organización actualizados",
      reason: `Moneda por defecto ${currency}.`,
    });
    toast.success("Ajustes guardados.");
  };

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Preferencias de la organización y del entorno de demostración."
        actions={
          <Button className="h-10" onClick={save}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Organización">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="org">Nombre</Label>
              <Input
                id="org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                aria-invalid={!!orgError}
                className="h-10"
              />
              {orgError && <p className="text-xs text-destructive">{orgError}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Moneda por defecto</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP · Peso colombiano</SelectItem>
                  <SelectItem value="USD">USD · Dólar estadounidense</SelectItem>
                  <SelectItem value="EUR">EUR · Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Panel>
        <Panel title="Tema">
          <RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as "light" | "dark")}
            className="grid gap-2"
          >
            {(
              [
                ["light", "Claro"],
                ["dark", "Oscuro"],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className="flex h-11 items-center gap-3 rounded-md border border-border px-3 text-sm has-[[data-state=checked]]:border-secondary"
              >
                <RadioGroupItem value={v} /> {l}
              </label>
            ))}
          </RadioGroup>
          <p className="mt-2 text-xs text-muted-foreground">
            Se guarda en este navegador. Por defecto se usa el tema claro de Blinka.
          </p>
        </Panel>
        <Panel title="Notificaciones">
          {(
            [
              ["approvals", "Nuevas solicitudes de aprobación"],
              ["blocked", "Operaciones bloqueadas por una política"],
              ["weekly", "Resumen semanal por correo"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex h-11 items-center justify-between gap-3 text-sm">
              {l}
              <Switch
                checked={notif[k]}
                onCheckedChange={(v) => setNotif({ ...notif, [k]: v })}
                aria-label={l}
              />
            </label>
          ))}
        </Panel>
        <Panel title="Entorno de demostración">
          <p className="text-sm text-muted-foreground">
            Todos los datos son simulados y se guardan solo en memoria. El agente pagador no está
            conectado a bancos: los pagos van a un sandbox simulado.
          </p>
          <Button variant="outline" className="mt-4 h-10" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            Restablecer datos de demostración
          </Button>
        </Panel>
      </div>
    </>
  );
}
