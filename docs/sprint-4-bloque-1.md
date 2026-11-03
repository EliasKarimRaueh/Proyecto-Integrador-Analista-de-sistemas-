# Sprint 4 — Bloque 1: abastecimiento y logística

## Circuito disponible

1. En **Productos**, configurar unidad de compra (`KILOS`, `UNIDADES`, `CAJONES`, `CAJAS`, `BOLSAS`, `BULTOS`) y factor: cuántos kilos/unidades de inventario contiene una presentación.
2. En **Proveedores**, asociar los productos que se podrán pedir. En **Inventario**, configurar sus mínimos con el modal existente.
3. En **Reposición**, consultar productos críticos o próximos al mínimo (hasta el 120%), filtrar por proveedor, definir el proveedor habitual entre los asociados y seleccionar productos para preparar un pedido. La sugerencia se redondea a presentaciones completas; se muestran presentación y cantidad base. Para productos próximos sin faltante, el formulario propone una presentación editable.
4. En **Pedidos**, registrar pedidos manualmente o desde reposición. Solo se admiten productos activos asociados al proveedor. Se puede consultar el detalle y cancelar únicamente pendientes.
5. Desde un pedido pendiente, **Registrar compra** precarga proveedor, cantidades y costos estimados; también se admiten compras directas. Cargar comprobante, fecha, costos efectivos y observaciones. El servidor calcula el total y genera la deuda en cuenta corriente. Todavía no ingresa stock.
6. Desde una compra pendiente, **Recibir mercadería** registra la recepción física. Se puede recibir por peso/unidad base (factor 1) o por presentación con su equivalencia. Para cajones de peso variable, cargar kilos pesados o ajustar la equivalencia real. Las diferencias con la factura requieren una observación.
7. En **Compras** y **Recepciones**, consultar historial por proveedor y fechas; compras también por estado. Los detalles muestran cantidades, costos, comprobante, observaciones, saldo pendiente y movimientos de recepción según corresponda.

## Reglas y compatibilidad

- Pedidos y compras conservan cantidades base; los detalles de compra y recepción conservan también presentación, cantidad y factor cuando corresponde.
- Ingresos y ajustes manuales permiten elegir compra/venta. El backend convierte a existencias base dentro de la transacción y conserva la equivalencia en el motivo del movimiento.
- Las existencias por unidad no admiten fracciones. Las unidades de compra base deben coincidir con la venta y tener factor 1; las otras equivalencias se configuran como presentaciones. Cantidades convertidas a stock usan tres decimales; los costos base se redondean a centavos y la vista previa usa el mismo costo base enviado al servidor.
- Una compra genera deuda y pasa el pedido a `FACTURADO`. Una recepción única incluye todos los productos, actualiza stock/costos y pasa compra/pedido a `RECIBIDA`/`RECIBIDO`.
- Una diferencia de recepción documenta lo recibido; no modifica automáticamente el importe facturado ni la deuda.
- El bloqueo de la compra y la restricción única de recepción impiden ingresar la misma compra dos veces. Los movimientos se procesan por ID de producto para mantener un orden de bloqueo estable.
- Ante un resultado de red incierto, los formularios impiden reenviar y remiten a revisar el historial.
- Los comprobantes históricos cargados directamente en cuenta corriente siguen disponibles; se registran como recibidos y sin mercadería pendiente.
- La edición del catálogo conserva la configuración logística si un cliente anterior omite esos campos. El frontend actual permite editarlos explícitamente.

## Base de datos e inicio

El inicio del backend ejecuta las migraciones de catálogo, precios/ofertas, compras, proveedores y cuentas corrientes. La migración de compras agrega tablas de pedidos/recepción, referencias, índices, observaciones de compra y proveedor habitual sin borrar datos existentes. Se consolidó `CompraRepository` como persistencia; los servicios manejan el circuito transaccional, reemplazando métodos antiguos incompatibles que copiaban pedidos del esquema anterior e ingresaban stock al facturar.

Nuevos datos de API:

- `POST/PUT /api/productos`: `unidadCompra`, `factorConversion`.
- `GET /api/stock`: incluye `unidadCompra` y `factorConversion`.
- `POST /api/stock/movimientos`: `unidad: "COMPRA" | "VENTA"` (predeterminado `VENTA`).
- `PUT /api/stock/:productoId/proveedor-habitual`: `{ "proveedorId": 5 }`; `null` quita la preferencia. Exige proveedor activo y asociación activa.
- `GET /api/compras/reposicion`: agrega `soloHabitual=true` junto con `proveedorId`; devuelve `proveedorHabitualId` si continúa activo y asociado.

## Verificación

```powershell
# Desde backend
npm.cmd run typecheck
npm.cmd run typecheck:tests
npm.cmd run test:jest -- --runInBand

# Desde frontend
npm.cmd run build
npm.cmd test
npm.cmd exec playwright test e2e/sprint4.spec.ts

# Desde database
npm.cmd run build
```

La integración de PostgreSQL debe ejecutarse en una base local dedicada terminada en `_test`, con `DATABASE_SSL=false`, `DATABASE_URL` apuntando a esa base y `TEST_SPRINT4_DATABASE=true`:

```powershell
# Desde backend, con esas variables definidas
npm.cmd run test:integration:sprint4
```

La prueba crea sus propias filas y requiere permisos para crear tablas/funciones de prueba. Verifica API real, migración idempotente, conversiones, deuda sin ingreso anticipado, cancelación, recepción única e historial. Un trigger de prueba provoca una falla durante el segundo movimiento y comprueba que la transacción revierte recepción, stock, costos y estados. No se ejecuta contra conexiones externas. Las pruebas Playwright simulan la API para validar los recorridos de interfaz.

Verificación realizada al cerrar el bloque: compilación de frontend/base de datos, typecheck de backend y sus pruebas, lint sin advertencias, 604 pruebas Jest, 103 pruebas Vitest, 3 recorridos Playwright (incluyendo móvil) y 7 comprobaciones sobre PostgreSQL aislado. Se verificaron además dos recepciones simultáneas: una devuelve 201 y la otra 409, con un único ingreso de stock.

El bloque 2 (caja, pesaje de promociones y su ciclo de vigencia/reactivación) queda pendiente de autorización.
