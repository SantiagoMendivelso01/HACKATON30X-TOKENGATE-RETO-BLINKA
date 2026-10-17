# Código fuente

| Carpeta / archivo        | Para qué sirve                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `lib/tokengate/`         | Dominio del agente pagador: tipos, motor de reglas, ledger, datos de demo y OCR.   |
| `lib/tokengate/orgs/`    | Organizaciones de demo (Andes Labs con el set de prueba, Acme Studio).             |
| `routes/`                | Pantallas. Cada archivo es una ruta (`app.facturas.tsx` → `/app/facturas`).        |
| `components/tg/`         | Componentes propios del producto (tabla de decisiones, detalle, barra lateral...). |
| `components/ui/`         | Componentes base de interfaz (shadcn/ui).                                          |
| `hooks/`                 | Hooks de React compartidos.                                                        |
| `test/`                  | Preparación y tests de la app.                                                     |
| `styles.css`             | Tema visual de Blinka (tokens de Tailwind).                                        |
| `server.ts` / `start.ts` | Entrada del servidor y middlewares (errores, CSRF).                                |
| `routeTree.gen.ts`       | Árbol de rutas generado automáticamente; no se edita a mano.                       |

La arquitectura completa está en [`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md).
