# blinka · Agente pagador

Un agente que revisa las cuentas de una empresa, decide cuáles pagar dentro de las reglas que la empresa define y le pide permiso a una persona cuando algo se sale de ellas. Cada decisión queda explicada y registrada.

Prototipo para el **Reto Blinka · Hackathon 30X** (equipo TokenGate). Todos los datos son ficticios y los pagos van a un sandbox simulado: no se mueve dinero real.

## Qué resuelve

| Criterio del reto                                              | Cómo lo cumple                                                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Seguridad**: cero pagos fuera de las reglas                  | Un motor de reglas determinista decide. El modelo de IA solo extrae datos. Solo se autoriza si todas las reglas que aplican se cumplen; una operación bloqueada no se puede aprobar desde la interfaz. |
| **Autonomía**: decidir sin intervención humana                 | El agente autoriza o bloquea por sí solo y escala a Finanzas únicamente lo que necesita criterio humano. En el set de prueba decide el 64% de las operaciones sin ayuda.                               |
| **Explicabilidad**: entender cada decisión sin abrir el código | Cada decisión muestra las 14 reglas evaluadas, el motivo en lenguaje claro y “qué habría cambiado la decisión”. La auditoría está encadenada con hash.                                                 |

## Empezar

Requisitos: **Node.js 22** (ver `.nvmrc`) y npm.

```bash
npm install
npm run dev
```

La app queda en <http://localhost:5180>. Sin más configuración funciona todo excepto el OCR; las facturas se pueden cargar a mano.

### Activar la lectura de facturas con Claude (OCR)

El OCR necesita una API key de Anthropic, que se lee en el servidor desde `ANTHROPIC_API_KEY`. Hay dos formas:

- **Windows, sin guardar la clave en disco**: el script la pide en la consola y levanta la app.
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev-con-clave.ps1
  ```
- **Cualquier sistema**: copia `.env.example` como `.env.local` (Git lo ignora), pon tu clave y exporta la variable antes de `npm run dev`.

## Scripts

| Comando             | Qué hace                                          |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en el puerto 5180          |
| `npm run build`     | Build de producción (servidor Node en `.output/`) |
| `npm start`         | Sirve el build de producción                      |
| `npm run typecheck` | Revisa tipos con TypeScript                       |
| `npm run lint`      | ESLint + Prettier                                 |
| `npm test`          | Tests con Vitest                                  |
| `npm run check`     | Tipos, lint y tests (lo mismo que corre la CI)    |
| `npm run format`    | Formatea todo con Prettier                        |

## Estructura

```
src/
├── lib/tokengate/          Dominio: no depende de React
│   ├── types.ts            Tipos del dominio (dinero en centavos)
│   ├── decision-engine.ts  Motor de 14 reglas + ledger del periodo
│   ├── store.tsx           Estado de la demo (React context), alertas y auditoría
│   ├── nl-rules.ts         Reglas escritas en español → cambio de política
│   ├── hash.ts             Registro de auditoría encadenado
│   ├── ocr.functions.ts    Función de servidor: lectura de facturas con Claude
│   ├── orgs/               Organizaciones de demo (Andes Labs, Acme Studio)
│   └── *.test.ts           Tests del motor y del set de prueba
├── routes/                 Pantallas (rutas por archivo de TanStack Start)
├── components/tg/          Componentes del producto
├── components/ui/          Componentes base (shadcn/ui)
└── styles.css              Tema de Blinka (tokens de Tailwind)
docs/                       Arquitectura y guion de demo
scripts/                    Utilidades de desarrollo
```

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Para presentar, ver [docs/DEMO.md](docs/DEMO.md).

## Pantallas

- **Dashboard**: los KPIs del reto en vivo: seguridad, autonomía, precisión, explicabilidad, presupuesto, cola de aprobación y alertas.
- **Facturas / Compras**: lo que reciben los agentes y su decisión. Permite cargar facturas (con OCR) y simular un correo entrante.
- **Agentes**: cada agente tiene sus categorías, su límite por operación y un estado (activo o en pausa).
- **Aprobaciones**: Finanzas aprueba, rechaza o pide información, con todo el contexto a la vista.
- **Políticas de pago**: límites, monedas, proveedores con contrato y reglas escritas en español, con simulación antes de aplicarlas.
- **Presupuestos**: disponible, reservado y pagado, por categoría, agente y moneda.
- **Alertas**: duplicados, suplantación, cambio de cuenta, instrucciones escondidas y presupuesto bajo.
- **Registro de decisiones / Auditoría**: historial con hash encadenado y exportación a CSV.
- **Red team**: un agente atacante envía facturas trampa; el tablero muestra cuántas se bloquearon.

## Stack

TanStack Start (React 19 + SSR), TypeScript, Tailwind CSS 4, shadcn/ui, Vitest y Nitro (build para Node). El OCR usa la API de Claude desde una función de servidor; la clave nunca llega al navegador.

## Alcance

**Entra:** leer facturas, decidir con reglas configurables, pedir aprobación humana y registrar cada decisión.

**No entra:** mover dinero real, abrir cuentas, verificar identidad ni tomar decisiones de cumplimiento o fraude. El estado vive en memoria y se reinicia al recargar. En producción, el motor y el registro deben vivir en un backend de confianza.
