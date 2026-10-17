import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme, type Theme } from "@/lib/tokengate/theme";

export function useThemeState() {
  const [theme, set] = useState<Theme>("light");
  useEffect(() => set(getTheme()), []);
  return [theme, (t: Theme) => { setTheme(t); set(t); }] as const;
}

export function ThemeToggle() {
  const [theme, update] = useThemeState();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => update(next)} aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
