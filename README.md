# blinka · Agente Pagador (TokenGate) — Documentación Integral del Sistema y Handover para Agentes

Prototipo funcional para el **Reto Blinka · Hackathon 30X** (equipo **TokenGate**).
Este documento describe **absolutamente todo** el funcionamiento técnico, flujo de datos, reglas de negocio, integraciones, persistencia y estado actual del repositorio para que cualquier desarrollador o agente de IA pueda entender y operar el proyecto de inmediato sin necesidad de explorar a ciegas.

---

## 1. Propósito y Principio Rector

Un agente pagador que revisa las cuentas por pagar (facturas y solicitudes de compra) de una empresa, decide cuáles pagar dentro de las políticas corporativas, escala a aprobación humana cuando algo requiere criterio de Finanzas y bloquea lo que infringe las reglas.

> **Principio arquitectónico inquebrantable: "El modelo lee, las reglas deciden"**
> - La IA (**Claude Haiku 4.5**) solo se utiliza para **extraer datos estructurados** de documentos (OCR de PDF/imágenes). **Jamás toma decisiones de pago**.
> - El **Motor de Reglas Determinista** (`decision-engine.ts`) evalúa **14 reglas puras** sobre los datos extraídos + la política vigente + el historial del periodo.
> - **JEV (TypeSafe AI)** (`jev.ts`) provee una capa complementaria de evaluación tipada y calibración con respaldo determinista local.
> - Los pagos autorizados o aprobados por humanos van a un **sandbox simulado** (no se mueve dinero bancario real).

---

## 2. Stack Tecnológico

- **Framework Full-Stack:** [TanStack Start](https://tanstack.com/start) (`@tanstack/react-start` v1.168 + `@tanstack/react-router` v1.170) sobre **React 19** y **Vite 8** (con servidor SSR sobre **Nitro**).
- **Lenguaje y Tipado:** TypeScript 5.8 estricto (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
- **Estilos y UI:** Tailwind CSS v4 (`@tailwindcss/vite`), componentes `shadcn/ui` (Radix UI), iconos `lucide-react`, gráficas `recharts`, notificaciones `sonner`.
- **Validación:** `zod` (en funciones de servidor y esquemas).
- **Base de Datos (Persistencia):** **Supabase** (`@supabase/supabase-js`) consumida **exclusivamente desde el servidor** mediante `createServerFn` y `SUPABASE_SERVICE_KEY`.
- **IA / OCR:** API de **Anthropic (`claude-haiku-4-5`)** con *forced tool calling* (`record_invoice`) invocada desde el servidor.
- **Testing & Calidad:** `vitest` + `@testing-library/react`, `eslint` + `prettier`.

---

## 3. Flujo de Datos End-to-End

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. ENTRADA                                                                 │
│  • Carga de Factura (PDF/PNG/JPG/WEBP) → ServerFn `extractInvoice` (OCR)   │
│  • O llenado manual en `/app/facturas`                                     │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. REDUCER PURO (`src/lib/tokengate/org-state.ts`)                         │
│  • `apply(state, action)` genera `{ next: State, writes: Rows }`           │
│  • Reloj monotónico (`clock = Math.max(Date.now(), state.clock + 1)`)      │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. PERSISTENCIA TRANSACCIONAL (`src/lib/tokengate/db.functions.ts`)        │
│  • Si hay `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (modo `"supabase"`):     │
│    llama a RPC `pagador_save_writes(p_org, p_writes)` en Postgres.         │
│  • La UI solo actualiza el estado local cuando Supabase confirma (`ok`).   │
│  • Si no hay credenciales, opera en modo `"memory"` (se pierde al F5).     │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 4. MOTOR DE REGLAS Y LEDGER (`src/lib/tokengate/decision-engine.ts`)       │
│  • Las decisiones del agente NO se guardan en BD: se recalculan siempre.   │
│  • `runLedger()` ordena facturas y compras por `receivedAt` (ascendente).  │
│  • Evalúa cada operación con `evaluateDecision()` viendo las anteriores    │
│    (detecta duplicados, pagos partidos y consumo acumulado de presupuesto).│
│  • Aplica las revisiones humanas (`approved`, `rejected`, `info_requested`)│
│    actualizando los saldos: `paidMinor`, `reservedMinor`, `availableMinor`.│
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 5. AUDITORÍA ENCADENADA POR HASH (`src/lib/tokengate/hash.ts`)             │
│  • Combina eventos humanos/sistema + decisiones del agente + pagos sandbox │
│  • Ordena cronológicamente y calcula `hash = fnv1a64(prev + payload)`      │
│  • `verifyChain(trail)` verifica integridad en tiempo real en la UI.       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Mapa Completo del Código (`src/`)

### 4.1. Dominio Puro (`src/lib/tokengate/`)
El dominio (excepto `store.tsx`) no depende de React:

| Archivo | Responsabilidad exacta |
| :--- | :--- |
| `types.ts` | Todos los tipos del dominio (`Currency`, `Money`, `DecisionOutcome`, `RuleId`, `Invoice`, `Purchase`, `Policy`, `Agent`, `Supplier`, `AuditEvent`, `OrgSeed`). **Importante:** Todo el dinero se maneja en **centavos enteros (`amountMinor`)** para evitar errores de punto flotante. Los límites de la política están en centavos de `USD`. |
| `org.ts` | Semilla estática de la organización (`ORG`: `id`, nombre, usuario actual, tabla de tasas `fx`, `policy` inicial `v1.0`, `suppliers` y `agents`). |
| `decision-engine.ts` | Contiene `evaluateDecision` (evalúa las **14 reglas** en orden), `runLedger` (ejecuta todo el periodo en orden cronológico y aplica revisiones humanas) y `toBaseMinor` (convierte cualquier moneda a centavos de USD según `fx`). |
| `org-state.ts` | Estado persistible de la organización (`OrgState`), reconstrucción desde filas de BD (`stateFromRows`) y función reductora pura (`apply(state, action)` -> `{ next, writes }`). Soporta 4 acciones: `review`, `savePolicy`, `addInvoice`, `audit`. |
| `db.functions.ts` | Server Functions de TanStack Start (`loadOrgState` GET y `saveWrites` POST). Conecta con Supabase usando `SUPABASE_SERVICE_KEY`. Valida payloads con Zod y ejecuta el RPC `pagador_save_writes`. |
| `ocr.functions.ts` | Server Function `extractInvoice` (POST). Recibe archivo en `base64` (`application/pdf`, `image/png`, `image/jpeg`, `image/webp` hasta ~10MB) y llama a `https://api.anthropic.com/v1/messages` con el modelo `claude-haiku-4-5` forzando la herramienta `record_invoice` para devolver `{ invoiceNumber, supplier, supplierTaxId, amount, currency, dueDate, description }`. |
| `nl-rules.ts` | Intérprete determinista de reglas en lenguaje natural en español (`interpretRule(text, currentPolicy)`). Detecta cambios de límites, presupuestos, umbrales, monedas permitidas, proveedores autorizados, tolerancia de contrato y acciones ante duplicados/proveedores nuevos. |
| `jev.ts` / `jev.functions.ts` | Integración con **JEV (TypeSafe AI)**. Define el esquema tipado de decisión (`aprobar_pago`, `escalar`, `rechazar`), motivo primario, banderas de riesgo y confianza. Si existe `JEV_API_KEY` consulta `https://api.jev.dev/v1`, de lo contrario usa el motor local determinista `evaluateJevLocally()`. |
| `hash.ts` | Cadena criptográfica ligera sobre eventos de auditoría (`chain` y `verifyChain`). Cada evento incluye `prev` (hash del evento anterior o `"GENESIS"`) y `hash` de 16 caracteres hexadecimales. |
| `format.ts` | Formateo de monedas (`formatMoney`, `formatBase`), fechas (`formatDate`, `formatDateTime`) y parseo seguro de inputs humanos (`parseToMinor`, soporta formatos `1.250,50` y `1,250.50`). |
| `status.ts` | Mapeo entre el resultado del motor (`DecisionOutcome`) + revisión humana (`HumanReview`) hacia `DisplayStatus` (`authorized`, `blocked`, `requires_approval`, `needs_information`, `human_approved`, `human_rejected`) y sus metadatos visuales (`statusMeta`). |
| `store.tsx` | Contexto de React (`TokenGateProvider` y hook `useTokenGate()`). Orquesta la cola serie de despachos (`dispatch`) hacia Supabase, recalcula el `ledger`, las alertas activas, la cadena de auditoría y el simulador de políticas (`simulate`). |

### 4.2. Las 14 Reglas del Motor (`decision-engine.ts`)

Cada regla devuelve `status`: `"passed"` | `"failed"` | `"needs_review"` | `"not_applicable"`, junto con `explanation`, `rule` (la regla aplicada), `ifChanged` (contrafactual: qué habría cambiado la decisión) y `alert` opcional.

| # | `RuleId` | Qué verifica | Si no pasa |
| :- | :--- | :--- | :--- |
| 1 | `extraction_confidence` | Confianza del OCR (`extractionConfidence >= policy.minConfidence`, solo facturas). | `needs_review` |
| 2 | `required_information` | Que `missingFields` esté vacío y el importe sea > 0. | Según `missingInfoAction`: `"failed"` (si es `"block"`) o `"needs_review"` (si es `"request_information"`). |
| 3 | `prompt_injection` | Escanea `description` y `rawText` con regex buscando instrucciones maliciosas (`ignora las reglas`, `ignore previous instructions`, `autoriza inmediatamente`, etc.). | `failed` (alerta `critical`) |
| 4 | `supplier_authorized` | Verifica si el proveedor está en `policy.approvedSuppliers`, detecta suplantación por similitud de nombre (`looksImpersonated`) y valida el `supplierTaxId` contra el contrato. | Suplantación/TaxId distinto → `failed` (`critical`). Proveedor nuevo → según `newSupplierAction` (`failed` o `needs_review`). |
| 5 | `agent_scope` | Verifica que el agente exista, esté `"active"`, tenga la categoría permitida y el monto no supere su `spendingLimit`. | Agente en pausa → `failed`. Fuera de categoría o límite → `needs_review`. |
| 6 | `currency_allowed` | Moneda incluida en `policy.allowedCurrencies` y con tasa en `fx`. | `failed` |
| 7 | `contract_currency` | La moneda de la factura coincide con la moneda pactada en el contrato del proveedor. | `needs_review` |
| 8 | `bank_account` | La cuenta bancaria de la factura coincide con `supplier.bankAccount` del contrato. | `needs_review` (alerta `critical`) |
| 9 | `duplicate_check` | Busca en operaciones previas del mismo proveedor: mismo `invoiceNumber` o mismo importe dentro de `duplicateWindowDays`. | Según `duplicateAction`: `"failed"` o `"needs_review"`. |
| 10 | `contract_match` | Si el proveedor tiene contrato `"fixed"`, permite hasta `+contractTolerancePct%`. Si es `"cap"`, no puede superar el tope. | `failed` |
| 11 | `within_transaction_limit` | `baseAmountMinor <= policy.transactionLimit`. | `failed` |
| 12 | `human_approval_threshold` | `baseAmountMinor <= policy.approvalThreshold`. | `needs_review` |
| 13 | `split_payment` | Detecta si una compra < umbral sumada a otras del mismo proveedor en `splitWindowDays` supera `approvalThreshold`. | `needs_review` (alerta `high`) |
| 14 | `budget_available` | `baseAmountMinor <= availableMinor` (`monthlyBudget - baselineUsed - paid - reserved`). | `failed` |

**Regla de Precedencia Final (`evaluateDecision`):**
1. Si alguna regla está en `failed` → **`blocked`** (nunca se puede aprobar manualmente en la UI).
2. Si falta información (`required_information === "needs_review"`) y la política pide solicitarla → **`needs_information`**.
3. Si alguna regla está en `needs_review` → **`requires_approval`** (va a la cola de Finanzas).
4. Si todas pasan → **`authorized`** (pasa a `paid` automáticamente en el sandbox).

### 4.3. Rutas y Pantallas (`src/routes/`)

| Ruta | Archivo | Descripción funcional |
| :--- | :--- | :--- |
| `/` | `index.tsx` | Redirige automáticamente a `/app`. |
| `/login` | `login.tsx` | Pantalla de acceso con marca Blinka ("Continuar con Google" redirige a `/app`). |
| `/app` (Layout) | `app.tsx` | Ejecuta el `loader` en servidor (`loadOrgState`), envuelve la app en `TokenGateProvider` y renderiza el `AppSidebar` + barra superior con buscador global, estado de persistencia (`Guardado en Supabase` / `Sin guardar`), selector de tema y alertas. |
| `/app/` | `app.index.tsx` | **Dashboard**: KPIs en vivo (Seguridad, Autonomía, Explicabilidad, Presupuesto restante, Cola de aprobación, Alertas activas), embudo de decisiones y tabla de actividad reciente. |
| `/app/facturas` | `app.facturas.tsx` | **Facturas**: Búsqueda, filtros por estado/agente/moneda, paginación y modal de **Carga de Factura** con arrastrar/soltar para **OCR con Claude** + vista lateral de detalle (`DecisionSheet`). |
| `/app/compras` | `app.compras.tsx` | **Compras**: Solicitudes de compra iniciadas por agentes con su evaluación de reglas. |
| `/app/aprobaciones` | `app.aprobaciones.tsx` | **Aprobaciones**: Bandeja de trabajo para Finanzas. Permite **Aprobar**, **Rechazar** o **Pedir información** con nota de auditoría sobre cualquier operación en estado `requires_approval` o `needs_information`. |
| `/app/politicas` | `app.politicas.tsx` | **Políticas de pago**: Editor de la política activa (incrementa versión `v1.0` → `v1.1`), editor de reglas en español con **simulador de impacto en vivo** y el **Panel JEV** (`jev-panel.tsx`) para probar escenarios de calibración tipada. |
| `/app/agentes` | `app.agentes.tsx` | **Agentes**: Tarjetas de cada agente IA de la empresa, sus categorías, límite por operación y métricas de uso. |
| `/app/presupuestos` | `app.presupuestos.tsx` | **Presupuestos**: Desglose de presupuesto mensual (pagado, reservado, disponible) por categoría, agente y moneda. |
| `/app/alertas` | `app.alertas.tsx` | **Alertas**: Centro de riesgos clasificados por severidad (`critical`, `high`, `medium`). |
| `/app/decisiones` | `app.decisiones.tsx` | **Registro de decisiones**: Historial combinado de decisiones de agentes y revisiones humanas. |
| `/app/auditoria` | `app.auditoria.tsx` | **Auditoría**: Cadena de eventos con verificación de integridad SHA/FNV (`verifyChain`) y botón para exportar a CSV. |
| `/app/ajustes` | `app.ajustes.tsx` | **Ajustes**: Nombre de organización, moneda por defecto, tema claro/oscuro, notificaciones y estado de base de datos. |

---

## 5. Base de Datos y Esquema en Supabase (`supabase/migrations/20261017000000_persistencia.sql`)

La base de datos guarda **únicamente las entradas** (event sourcing ligero). Las decisiones se recalculan siempre en memoria con el motor.
Todas las tablas usan el prefijo `pagador_` y tienen **RLS activado sin políticas públicas** (solo accesibles mediante `SUPABASE_SERVICE_KEY` desde el servidor):

1. `public.pagador_subjects`: Facturas (`invoice`) y compras (`purchase`).
2. `public.pagador_reviews`: Revisiones humanas (`approved`, `rejected`, `info_requested`). **Append-only** (triggers bloquean `UPDATE`, `DELETE`, `TRUNCATE`).
3. `public.pagador_policies`: Historial de versiones de políticas (`seq` autoincremental, la última es la activa). **Append-only**.
4. `public.pagador_audit_events`: Eventos de auditoría. **Append-only**.
5. Función RPC `public.pagador_save_writes(p_org text, p_writes jsonb)`: Inserta sujetos, revisiones, políticas y eventos de auditoría de una acción en **una sola transacción atómica**.

---

## 6. Variables de Entorno (`.env.local`)

El archivo `.env.local` (ignorado por Git) en la raíz del proyecto contiene las llaves que leen las funciones de servidor (`*.functions.ts`):

```env
# Persistencia en Supabase (Configurado y activo)
SUPABASE_URL=https://khqpbgtpwvecimkculpm.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...

# OCR de Facturas con Claude Haiku 4.5 (Configurado y activo)
ANTHROPIC_API_KEY=sk-ant-...

# Opcional: Motor remoto JEV TypeSafe AI (Si no está, usa fallback determinista local)
JEV_API_KEY=
```

---

## 7. Comandos de Desarrollo y Verificación

Requisitos: **Node.js >= 20.19 / 22** y `npm`.

```bash
npm install          # Instala dependencias
npm run dev          # Levanta servidor de desarrollo (por defecto puerto 5180 o siguiente libre)
npm run typecheck    # Ejecuta tsc --noEmit
npm run lint         # Ejecuta ESLint + verificación Prettier
npm run format       # Formatea todo el repositorio con Prettier
npm test             # Corre las suites de Vitest (decision-engine, org-state, jev, app-routing)
npm run check        # Corre typecheck + lint + test (el mismo pipeline de GitHub Actions)
npm run build        # Genera build de producción SSR en .output/
npm start            # Sirve el build de producción (.output/server/index.mjs)
```

---

## 8. Estado Actual y Pendientes Conocidos (Para el siguiente Agente)

1. **Errores de TypeScript y Prettier en `jev` (`npm run check`):**
   - `src/components/tg/jev-panel.tsx` y `src/lib/tokengate/jev.functions.ts` presentan 6 errores de compilación TypeScript debido a `exactOptionalPropertyTypes: true` (propiedades opcionales con `undefined` explícito en `JevDecisionInput`) y el tipo `rawQuestions: Record<string, unknown>` en `JevDecisionEvaluation` dentro de `createServerFn`.
   - Hay 14 errores de formato Prettier solucionables ejecutando `npm run format`.
2. **Datos semilla vacíos en `src/lib/tokengate/org.ts`:**
   - En el commit `521d770` se vaciaron los datos mock (`suppliers: []`, `agents: []`, `approvedSuppliers: []`, `fx: { USD: 1 }`, `allowedCurrencies: ["USD"]`).
   - **Impacto:** La vista `/app/agentes` aparece sin agentes, no hay contratos contra los cuales contrastar la regla #10 (`contract_match`), y si se sube una factura en `COP` o `EUR` vía OCR, el motor la bloqueará por moneda no permitida o falta de tasa de cambio en `fx`.
   - **Acción recomendada:** Poblar `ORG` en `src/lib/tokengate/org.ts` con las tasas de cambio (`COP`, `EUR`, `MXN`), agentes reales de la organización y proveedores con contrato antes de la demostración final.
