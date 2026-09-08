# PROGRESO — El Buen Café (checkpoint para continuar en otra PC)

**Última actualización:** 07/09/2026 (hora local CDMX)
**Estado:** T3 COMPLETADO. Pendiente: verificación visual + commit del checkpoint 2.

---

## Contexto del trabajo en curso

Reorganización del Panel de Administración: quitar módulo de "pedidos" (delivery) porque
la app no lleva pedidos a domicilio, renombrar a "Ventas", arreglar fecha (CDMX/UTC) y
corregir los totales en $0.00 del corte de caja.

## LO QUE YA ESTÁ HECHO Y COMMITEADO (commit `551f2e3`)

> Nota: se hizo `git add -A && git commit` para que el trabajo pueda copiarse junto a la
> carpeta del proyecto. NO se hizo `git push`. Si el directorio completo se copia a otra
> PC, todo viaja dentro (incluido `.git`).

### T1 — Ocultar pedidos a domicilio (sin borrar código)
- `src/components/AdminDashboard.tsx`:
  - Flag `MODULO_DELIVERY_VISIBLE = false` (const y comento arriba de la componente).
  - Filtro "Delivery" de la lista: envuelto en `MODULO_DELIVERY_VISIBLE && (...)`.
  - Botón "Ticket" de reparto: condicionado a `MODULO_DELIVERY_VISIBLE && order.type === 'domicilio'`.
  - Etiqueta "Domicilio" de cada fila: condicionada al flag (si no, muestra "Mesa N").
  - `onlineDailyOrders = MODULO_DELIVERY_VISIBLE ? getOrdersByDate(selectedDate) : []`.
  - ELIMINADO el import muerto `obtenerCuentasCobradasEnFecha` (se importaba pero nunca se usaba).
  - NOTA: `ClientView`, `OrderContext`, tabla `ordenes_cliente` están INTACTOS.
    Para reactivar delivery → cambiar el flag a `true`.
- `src/context/AccountContext.tsx`: sin cambios para esto.

### T2 — Renombrar "Pedidos" → "Ventas" / "Cuentas"
- KPI: "Pedidos" → "Cuentas".
- Título lista: "Pedidos del Día" → "Ventas del Día".
- "Ventas Contabilizadas" ya existía.
- "No hay pedidos registrados..." → "No hay ventas registradas para esta fecha".
- Reporte descargable: "Cantidad de Pedidos" → "Cantidad de Ventas", "Pedido #" → "Venta #".
- Modal corte: **PENDIENTE** (queda "Total de Pedidos" / "Pedidos Cobrados" — ver T3).

### T4 — Fecha local CDMX (arregla el bug del "domingo 6")
- Helpers nuevos en `AdminDashboard.tsx` (constantes fuera de la componente):
  - `obtenerFechaLocalYYYYMMDD()` — reemplaza `new Date().toISOString().split('T')[0]` (state `selectedDate`).
  - `parsearFechaLocal(fecha)` — `new Date(y, m-1, d)` (evita parseo UTC).
  - `formatearFechaLocal(fecha)` — para mostrar "lunes, 7 de septiembre".
  - `obtenerRangoDiaUTC(fecha)` — rango 00:00–24:00 CDMX (UTC-6) convertido a instantes UTC.
- Aplicado en:
  - State inicial `selectedDate`.
  - Query de `cuentas` (fetcheo de ventas locales): `{ inicio, fin } = obtenerRangoDiaUTC(selectedDate)`.
  - Header del modal Reporte: "Fecha: {formatearFechaLocal(selectedDate)}".
- **PENDIENTE:** modal Corte de Caja línea ~1606 aún usa `new Date(selectedDate)...` → corregir con `formatearFechaLocal(selectedDate)`.

### T5 — Total $0.00 en cuentas cobradas (CAUSA RAÍZ CONFIRMADA con base real)
- Diagnóstico: consulta directa a Supabase mostró que TODAS las cuentas tienen
  `total_pagado = 0` y `total_acumulado = 0`, incluso las que sí tuvieron venta.
  Las cuentas del día (id 270-274) ni siquiera tienen minicomandas.
- CAUSA: `cobrarAsientos` en `src/context/AccountContext.tsx` cerraba las cuentas
  liquidadas con `cerrarCuenta(c.id, 0, 0, metodoPago)` — guardaba monto 0 SIEMPRE.
- FIX aplicado en `AccountContext.tsx`:
  - Ahora acumula el monto real por cuenta: suma de `it.total_item` de ítems de los
    asientos cobrados + porciones pagadas de ítems compartidos (`share.monto`).
  - Cierra con ese monto: `cerrarCuenta(c.id, montoCierre, 0, metodoPago)`.
  - Las otras dos llamadas `cerrarCuenta(..., 0, 0, ...)` (liberarMesa y combinarCuenta)
    son CANCELACIÓN/MERGE y SON CORRECTAS — no se tocaron.
- FIX defensivo en `AdminDashboard.tsx`: total de cuentas locales ahora usa
  `cuenta.total_pagado || cuenta.total_acumulado || totalDesdeItems` (calcula desde ítems).

## VERIFICACIONES HECHAS
- [x] `npx tsc --noEmit` → PASA SIN ERRORES (tras los cambios T1/T2/T4/T5).
- [x] Commit checkpoint `551f2e3` creado en `main` (NO pusheado).
- [x] `.env` NO se sube (está en `.gitignore`) — copiarlo aparte si se clona en otra PC.

## LO QUE FALTA (PENDIENTE)

### T3 — Reagrupar botones de acción + paleta unificada (COMPLETADO)
- Botones divididos en DOS secciones con subtítulos:
  - "OPERACIÓN": Gestionar Menú, Extras, Gestionar Empleados.
  - "ADMINISTRACIÓN": Descargar Reporte, Configuración, Corte de Caja.
- Paleta unificada: dorado (Menú/Extras) y verde (Empleados/Reporte/Configuración);
  ROJO exclusivo para Corte de Caja. Se eliminó el rosa de "Extras".
- Modal corte renombrado: "Total de Pedidos" → "Total de Ventas",
  "Pedidos Cobrados" → "Ventas Cobradas", "Detalles de Pedidos" → "Detalles de Ventas",
  "DETALLE DE PEDIDOS" (reporte) → "DETALLE DE VENTAS",
  advertencia "archivará todos los pedidos" → "todas las ventas".

### T4 resto — Modal corte fecha (COMPLETADO)
- Modal corte ahora usa `formatearFechaLocal(selectedDate)`.
- `handleDownloadReport` también usa `formatearFechaLocal(selectedDate)` (antes `new Date(selectedDate)`).

### Verificación final
- [x] `npx tsc --noEmit` → PASA SIN ERRORES.
- [x] `npm run build` → OK (solo warnings preexistentes de chunk/dynamic import).
- [ ] `npm run dev` + revisión visual del panel admin (KPI, secciones, corte).

## OTROS CAMBIOS QUE HABÍA SIN COMMITEAR (YA INCLUIDOS EN EL COMMIT 551f2e3)
- `src/App.tsx`, `ClientView.tsx`, `ProductDetailModal.tsx`, `WaiterView.tsx`,
  `db/Queries.ts`, `db/Schema.ts`, `db/SupabaseQueries.ts`, `db/SupabaseQueriesImpl.ts`,
  `SplashScreen.tsx`, `useProductos.ts`, `supabase/fix_mesas_rls_ocupacion.sql`,
  `supabase_migration_productos.sql`.
- ⚠️ SI el commit `551f2e3` contiene cambios tuyos previos que NO querías transferir,
  avísame antes de continuar y los separo.

## CÓMO CONTINUAR EN OTRA PC
1. Copiar TODO el directorio del proyecto (incluida la carpeta `.git`).
2. En la otra PC: `npm install` (si no están los node_modules).
3. Copiar `.env` (NO viaja por git) con las variables Supabase.
4. Abrir opencode en `D:\PROYECTOS\ElbuenCafe\ElbuenCafe` y continuar con T3.