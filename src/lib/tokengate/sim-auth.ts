// Sesión simulada de demostración: no hay autenticación real.
// Los datos están quemados y solo viven en localStorage del navegador.

export interface SimUser {
  name: string;
  email: string;
  initials: string;
  role: string;
  provider: "google";
}

export const SIM_USER: SimUser = {
  name: "Juan Muñoz",
  email: "juan.munoz@blinka.co",
  initials: "JM",
  role: "Aprobador · Demo",
  provider: "google",
};

const KEY = "tokengate.sim.user";

export function getSimUser(): SimUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SimUser) : null;
  } catch {
    return null;
  }
}

export function signInSimulated(): SimUser {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(SIM_USER));
  } catch {
    // sin almacenamiento disponible: la sesión solo dura la navegación
  }
  return SIM_USER;
}

export function signOutSimulated(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nada que limpiar
  }
}
