# Completar datos faltantes desde «Pedir más datos»

## Qué cambia para el usuario
- Al pulsar «Pedir más datos» (o en registros con estado «Faltan datos»), el diálogo muestra un campo por cada dato que falta en la factura o compra, por ejemplo **NIT / Identificación fiscal**, **Cuenta bancaria**, **Fecha de vencimiento**.
- Los campos vienen precargados con lo que ya se conoce y marcados como obligatorios; el botón «Guardar y reevaluar» se habilita solo cuando todos están llenos y con formato válido (p. ej. NIT con dígitos y guion opcional).
- Al guardar, el agente vuelve a evaluar el registro con las mismas reglas: si ya no falta nada, pasa a «Requiere aprobación» o «Aprobado automáticamente» según la política, y el cambio queda en el registro de auditoría con quién lo completó y la nota opcional.
- Si el registro no tiene datos faltantes, el diálogo conserva el comportamiento actual (solicitud simulada al proveedor con nota).
- Todo sigue siendo simulado: los registros originales de la base de datos no se modifican y los cambios se pierden al recargar.

## Detalles técnicos
- `decision-detail.tsx`: el diálogo de `info_requested` renderiza inputs derivados de `s.missingFields`; mostrar el botón también cuando `status === "needs_information"`.
- Nuevo mapa `missing-fields.ts` en `src/lib/tokengate/`: etiqueta de campo → clave del sujeto (`taxId`, `bankAccount`, `dueDate`…), tipo de input y validador; etiquetas desconocidas se guardan como texto libre.
- `store.tsx`: nueva acción `completeFields(subjectId, values, note)` que actualiza el sujeto, vacía los `missingFields` completados, recalcula con el motor existente (sin reimplementar reglas en la UI) y añade un evento `info_completed` encadenado al registro.
- Test en `missing-fields.test.ts`: completar el NIT elimina el faltante y el motor deja de devolver `needs_information`.
