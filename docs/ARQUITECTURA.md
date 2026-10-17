# Arquitectura

## Principio: el modelo lee, las reglas deciden

```
Factura (correo, PDF, imagen, chat) ─┐
Solicitud de compra de un agente ────┤
                                     ▼
                    1. Extracción (Claude, salida estructurada)
                                     ▼
                    2. Motor de reglas determinista (14 reglas)
                                     ▼
          ┌──────────────┬───────────┴──────────┬──────────────────┐
     Autorizada      Requiere aprobación   Pendiente de info.    Bloqueada
     (sandbox)       (Finanzas decide)     (se pide el dato)     (no se paga)
          └──────────────┴──────────┬───────────┴──────────────────┘
                                     ▼
                    3. Ledger del periodo + registro encadenado por hash
```

El modelo de IA nunca decide si se paga. Solo convierte el documento en datos (`ocr.functions.ts`). La decisión la toma `evaluateDecision` en `decision-engine.ts`, una función pura: con los mismos datos, la misma política y el mismo historial, siempre da el mismo resultado.

## Motor de reglas (`src/lib/tokengate/decision-engine.ts`)

Cada regla devuelve `passed`, `failed`, `needs_review` o `not_applicable`, más una explicación, la regla de la política que aplicó, “qué habría cambiado” y, si corresponde, una alerta con severidad.

| #   | Regla                                                                 | Si falla                                  |
| --- | --------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Lectura confiable (confianza mínima del OCR)                          | Escala                                    |
| 2   | Información obligatoria completa                                      | Pide información o bloquea (configurable) |
| 3   | Sin instrucciones escondidas para el agente                           | Bloquea                                   |
| 4   | Proveedor autorizado (incluye suplantación e ID fiscal)               | Bloquea o escala                          |
| 5   | Dentro del alcance del agente (límite, categorías, en pausa)          | Bloquea o escala                          |
| 6   | Moneda permitida                                                      | Bloquea                                   |
| 7   | Moneda acordada en el contrato                                        | Escala                                    |
| 8   | Cuenta bancaria registrada                                            | Escala                                    |
| 9   | No es un cobro duplicado (mismo número / mismo importe en la ventana) | Bloquea o escala                          |
| 10  | Cuadra con el contrato (fijo ± tolerancia o tope)                     | Bloquea                                   |
| 11  | Dentro del límite por transacción                                     | Bloquea                                   |
| 12  | Umbral de aprobación humana                                           | Escala                                    |
| 13  | No parece un pago partido                                             | Escala                                    |
| 14  | Queda presupuesto en el periodo (pagado + reservado)                  | Bloquea                                   |

**Precedencia:** cualquier regla `failed` → bloqueada; si falta información y la política dice pedirla → pendiente de información; cualquier `needs_review` → requiere aprobación; si no, autorizada.

## Ledger (`runLedger`)

1. Ordena facturas y compras por fecha de llegada y las evalúa una por una. Cada evaluación ve el historial anterior, lo que permite detectar duplicados y pagos partidos, y el presupuesto ya pagado o reservado.
2. Lo autorizado se suma a _pagado_; lo que espera a una persona se suma a _reservado_.
3. Aplica las revisiones humanas en el orden en que se hicieron: aprobar pasa el importe de _reservado_ a _pagado_ y genera un pago en el sandbox; rechazar libera la reserva.
4. Solo se pueden revisar operaciones pendientes. Una bloqueada no se aprueba: hay que corregir la factura o cambiar la política.

Cambiar la política vuelve a correr el ledger completo. Así funciona la simulación de las reglas en español: se compara el estado de cada operación antes y después.

## Dinero y monedas

- Todo importe se guarda en **centavos enteros** (`amountMinor`), para que no haya errores de punto flotante en límites y presupuesto.
- Los límites de la política están en **USD**. Cada organización trae una tabla de cambio (`fx`: unidades por 1 USD) y el motor convierte cada operación con `toBaseMinor`.
- Para leer importes escritos por una persona se usa `parseToMinor`, que acepta tanto `1.250,50` como `1,250.50`.

## Estado y auditoría (`store.tsx`)

- Estado en memoria con `useReducer`. Arranca vacío (sin facturas, compras ni auditoría) y se pierde al recargar hasta que haya persistencia.
- La organización, su usuario, agentes, proveedores, tabla de cambio y política inicial viven en `org.ts`. Hoy son valores por defecto; las integraciones reales los reemplazan.
- El store expone el ledger, las listas evaluadas, las alertas y el **registro de auditoría**: eventos humanos y del sistema, más cada decisión del agente y cada pago, en orden cronológico y encadenados con `hash.ts`. `verifyChain` detecta cualquier evento editado.

## Cómo extender

**Agregar una regla**

1. Añade el id a `RuleId` en `types.ts`.
2. Agrega la evaluación en `evaluateDecision`, con `explanation`, `rule`, `ifChanged` y `alert` si corresponde.
3. Escribe un test en `decision-engine.test.ts`.

**Agregar una pantalla**

1. Crea `src/routes/app.<nombre>.tsx`. El árbol de rutas (`routeTree.gen.ts`) se regenera solo; no se edita a mano.
2. Añádela a `navGroups` en `components/tg/app-sidebar.tsx`.

## Convenciones

- La UI nunca reimplementa reglas: consume `result.rules` y `result.outcome` del motor.
- El dominio (`lib/tokengate`) no importa React, salvo `store.tsx`.
- El código de servidor va en `*.functions.ts` (funciones de servidor de TanStack Start); las claves solo se leen ahí.
- Formato con Prettier (LF, ancho 100). `npm run check` debe pasar antes de abrir un PR.
