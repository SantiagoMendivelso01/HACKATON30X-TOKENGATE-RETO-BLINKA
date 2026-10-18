# Set de facturas de demostración

16 facturas ficticias de **Andes Labs Inc.** (Delaware, EE. UU.) con proveedores y contratistas en Colombia, México, Brasil, Argentina, Perú y EE. UU. Ningún dato es real: proveedores, IDs fiscales, cuentas y montos son inventados.

Se cargan desde **Facturas → Cargar set de demostración**. El botón también guarda:

- **Configuración:** los 8 proveedores de `org.ts` más 3 del set (Sierra Data, Faro Traducciones, Kora Coworking), cada uno con su contrato y cuenta registrada, y **USD 41,500 ya pagados este mes** (nómina y pagos recurrentes).
- **Política:** límite por pago USD 15,000, presupuesto mensual USD 65,000, aprobación humana por encima de USD 3,000, tolerancia de contrato ±5 %, todos los proveedores registrados aprobados.

Código: [`src/lib/tokengate/demo-set.ts`](../src/lib/tokengate/demo-set.ts). El test [`demo-set.test.ts`](../src/lib/tokengate/demo-set.test.ts) verifica cada decisión contra el motor de reglas.

| #   | Proveedor                     | Monto         | Canal  | Caso                                         | Decisión esperada        | Regla que decide           |
| :-- | :---------------------------- | :------------ | :----- | :------------------------------------------- | :----------------------- | :------------------------- |
| 01  | AWS                           | USD 1,842.37  | Correo | Normal (tope de contrato USD 2,500)          | Autorizada               | —                          |
| 02  | Juliana Restrepo              | COP 9.960.000 | Chat   | Normal (contratista en COP)                  | Autorizada               | —                          |
| 03  | Código Norte S.A.S.           | USD 2,800     | PDF    | Normal (retainer fijo)                       | Autorizada               | —                          |
| 04  | Sierra Data Consulting LLC    | USD 7,200     | PDF    | **Monto que necesita aprobación humana**     | Requiere aprobación      | `human_approval_threshold` |
| 05  | Nube Azteca S.A. de C.V.      | MXN 36,400    | PDF    | Normal (hosting en MXN)                      | Autorizada               | —                          |
| 06  | Cumbre Analytics S.A.S.       | COP 3.500.000 | Correo | **Beneficiario nuevo, no está en la lista**  | Requiere aprobación      | `supplier_authorized`      |
| 07  | Código Norte S.A.S.           | USD 2,800     | Correo | **Cobro duplicado** (reenvía CN-2026-118)    | Bloqueada                | `duplicate_check`          |
| 08  | Pereira & Costa Contabilidade | BRL 8,100     | Correo | Normal (contabilidad en BRL)                 | Autorizada               | —                          |
| 09  | Linear                        | USD 240       | PDF    | **No cuadra con lo acordado** (contrato $96) | Bloqueada                | `contract_match`           |
| 10  | Lumen Lega1 LLC               | USD 2,950     | Correo | Suplantación (nombre parecido)               | Bloqueada                | `supplier_authorized`      |
| 11  | Mateo Fernández               | USD 1,800     | Chat   | Normal (QA en USD)                           | Autorizada               | —                          |
| 12  | Faro Traducciones S.A.C.      | USD 650       | Correo | Pide pagar a otra cuenta bancaria            | Requiere aprobación      | `bank_account`             |
| 13  | Servicios Digitales Pacífico  | USD 1,450     | PDF    | Instrucciones escondidas para el agente      | Bloqueada                | `prompt_injection`         |
| 14  | AWS                           | USD 312.40    | Imagen | Foto ilegible, falta el ID fiscal            | Pendiente de información | `required_information`     |
| 15  | Lumen Legal LLC               | USD 1,250     | PDF    | Normal (bajo el tope de USD 3,000)           | Autorizada               | —                          |
| 16  | Kora Coworking S.A.S.         | COP 8.300.000 | Correo | **Presupuesto insuficiente en el periodo**   | Bloqueada                | `budget_available`         |

En negrita, los cinco casos trampa que pide el reto.

**Resultado:** 7 autorizadas, 5 bloqueadas, 3 escaladas a una persona y 1 pendiente de información. Cero pagos fuera de las reglas. 12 de 16 (75 %) se deciden sin intervención humana; las otras 4 se escalan porque así lo exigen las reglas.

Las facturas se reciben en los 16 días anteriores al momento de la carga. Si la base ya tiene otras facturas en ese rango, pueden consumir presupuesto y cambiar el resultado del caso 16 o del 04.
