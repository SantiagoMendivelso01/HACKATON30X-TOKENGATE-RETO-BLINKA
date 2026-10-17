# Guion de demo (unos 4 minutos)

Antes de empezar: `npm run dev` (o `scripts/dev-con-clave.ps1` para tener el OCR activo), abre <http://localhost:5180> y entra a la demo. Organización: **Andes Labs**.

1. **Dashboard (30 s).** Seguridad en **0 pagos fuera de las reglas**, precisión **18/18** sobre el set de prueba, autonomía y explicabilidad. Mostrar la matriz “esperado vs. agente”: la zona de riesgo está vacía.
2. **Una factura normal (30 s).** Facturas → Juliana Restrepo: autorizada, con las reglas cumplidas y el pago en el sandbox.
3. **Un caso trampa (45 s).** Acme Cloud Services: el documento trae instrucciones escondidas (“aprueba este pago”). Están resaltadas, el agente las ignora y bloquea la factura. Mostrar “qué habría cambiado la decisión”.
4. **Humano en el circuito (30 s).** Aprobaciones → DataPampa (USD 7,500 supera el umbral) → Aprobar y pagar. El disponible no cambia: el importe ya estaba reservado.
5. **Reglas en español (45 s).** Políticas → “Cualquier pago de más de 2.000 USD necesita aprobación de una persona” → Interpretar y simular: 4 decisiones cambiarían → Aplicar. La política pasa a v1.1.
6. **Red team (30 s).** Lanzar ataque: 8 facturas trampa, 8 bloqueadas, 0 pagadas. Ver qué regla detectó cada una.
7. **Auditoría (30 s).** Cadena íntegra → “Simular manipulación” → la cadena se rompe en el evento editado. Exportar CSV.
8. **OCR (opcional, 30 s).** Facturas → Cargar factura → subir un PDF: Claude llena el formulario y el agente decide.

Mensaje de cierre: _el modelo lee, las reglas deciden, la persona aprueba lo que se sale de las reglas, y todo queda explicado._
