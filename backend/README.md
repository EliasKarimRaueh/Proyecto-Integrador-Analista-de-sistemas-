# Backend de AvixSoft — Sprints 2 a 4

Desde `database`, instalar dependencias con `npm ci`. Guardar la conexión provista en `database/.env` como `DATABASE_URL=postgresql://...`. Desde `backend`, ejecutar `npm ci` y `npm run dev`. En PowerShell con scripts deshabilitados usar `npm.cmd`.

Supabase utiliza SSL por defecto. Para PostgreSQL local configurar `DATABASE_SSL=false`. `SQL_LOG=true` habilita el registro de consultas. El puerto predeterminado es 3000; `PORT` permite cambiarlo.

## Proveedores

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/proveedores?activo=true\|false` | Listar proveedores; sin filtro devuelve todos |
| GET | `/api/proveedores/:id` | Proveedor por ID |
| POST | `/api/proveedores` | Crear proveedor |
| PUT | `/api/proveedores/:id` | Actualizar proveedor |
| DELETE | `/api/proveedores/:id` | Dar de baja lógica |
| PUT | `/api/proveedores/:id/reactivar` | Reactivar proveedor |

```json
{
  "nombre": "Distribuidora Sur",
  "cuil": "20123456789",
  "descripcion": "Aves frescas",
  "ctaCte": true,
  "telefono": "1145678900",
  "email": "ventas@sur.com"
}
```

El nombre es obligatorio y admite hasta 50 caracteres. El CUIL, cuando se informa, debe tener 11 dígitos; el teléfono entre 10 y 15 dígitos; el email debe terminar en `.com`. La baja es lógica: el proveedor queda inactivo y conserva sus datos.

## Catálogo producto-proveedor

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/catalogo/proveedor/:proveedorId?activo=true` | Productos asociados a un proveedor |
| GET | `/api/catalogo/producto/:productoId` | Proveedores asociados a un producto |
| POST | `/api/catalogo` | Asociar producto y proveedor |
| PUT | `/api/catalogo/:productoId/:proveedorId` | Activar o desactivar la relación |
| DELETE | `/api/catalogo/:productoId/:proveedorId` | Dar de baja lógica la relación |

```json
{
  "productoId": 10,
  "proveedorId": 5
}
```

Para `PUT`, enviar `{ "activo": true }` o `{ "activo": false }`. Solo se asocian productos y proveedores activos. La relación es única por producto y proveedor, y la baja es lógica.

## Ventas y mostrador

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/ventas/productos?q=pollo` | Buscar productos activos por código o nombre |
| POST | `/api/ventas/cotizacion` | Calcular carrito sin guardar venta ni cambiar stock |
| POST | `/api/ventas` | Guardar venta, detalles y egresos de stock en una transacción |
| GET | `/api/ventas` | Historial paginado con detalles |
| GET | `/api/ventas/:id` | Venta con todos sus detalles |

Cotización y venta reciben el mismo cuerpo:

```json
{
  "usuarioId": 1,
  "tipoPrecio": "MINORISTA",
  "detalles": [
    { "productoId": 1, "cantidad": 1.25 },
    { "productoId": 2, "cantidad": 2, "tipoPrecio": "MAYORISTA" },
    { "ofertaId": 3, "cantidad": 1 }
  ]
}
```

Cada detalle debe indicar exactamente un producto u oferta. Las cantidades de productos por unidad y de ofertas deben ser enteras. Los kilos admiten fracciones. Los importes se calculan en el servidor con precios vigentes y redondeo decimal a centavos; el cliente no determina precios ni totales. Las ofertas consumen y cobran únicamente sus componentes activos, y deben estar vigentes. Se conserva el nombre y el precio en el detalle para la auditoría posterior.

Los componentes de una oferta admiten `cantidad` al crearla y al actualizar su precio mediante `PUT /api/ofertas/:id/productos/:productoId`; el valor predeterminado al crear es 1. `precioOferta` representa el importe total de ese componente por combo, y `cantidad` determina el descuento de stock. Los productos por unidad requieren cantidades enteras. Las respuestas de detalle incluyen la cantidad.

La respuesta de cotización es `{ "total": "...", "detalles": [...] }`; la confirmación devuelve `{ "venta": {...}, "detalles": [...] }`. El subtotal y el total no pueden superar 99999999.99. Una cotización no reserva mercadería: al confirmar se valida nuevamente el carrito.

## Inventario

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/stock` | Grilla de productos activos con estado de reposición |
| POST | `/api/stock/movimientos` | Entrada, salida, ajuste o baja justificada |
| GET | `/api/stock/movimientos` | Historial paginado general |
| GET | `/api/stock/movimientos/:productoId` | Historial de un producto |
| PUT | `/api/stock/:productoId/reposicion` | Configurar `{ "stockMinimo": 5 }` |
| POST | `/api/stock/fraccionamientos` | Transformar origen en derivados y registrar merma |

El estado es **Crítico** si el stock es cero, negativo o menor/igual al mínimo; **Próximo al Mínimo** si supera el mínimo pero no su 120%; **Normal** en los demás casos. La proximidad del 20% es la regla adoptada para este Sprint. Sin mínimo configurado, sólo el stock no positivo es crítico.

Ejemplo de movimiento:

```json
{
  "productoId": 1,
  "tipo": "INGRESO",
  "cantMovimiento": 10,
  "motivo": "Recepción de mercadería",
  "usuarioId": 1
}
```

Tipos admitidos: `INGRESO`, `EGRESO`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `MERMA`, `PERDIDA`, `VENCIMIENTO`, `ROTURA` y `AJUSTE`. `AJUSTE` recibe `stockObjetivo` en lugar de `cantMovimiento`; si no cambia el stock, devuelve `null` y no genera movimiento. El motivo es obligatorio y admite hasta 250 caracteres. Las cantidades se expresan en la unidad de venta/stock del producto, sin conversión de cajones o cajas.

La tabla existente utiliza sólo `INGRESO`/`EGRESO`: ajustes y bajas se identifican mediante el prefijo de `motivo`. Se preserva la política del modelo: `margenStock=0` prohíbe stock negativo, un valor positivo permite bajar hasta su negativo, y `null` no impone límite. Los faltantes que exceden el margen devuelven HTTP 409. Productos inactivos no admiten operaciones.

## Desposte y fraccionamiento

```json
{
  "productoOrigenId": 1,
  "cantidadOrigen": 10,
  "derivados": [
    { "productoId": 2, "cantidad": 5.5 },
    { "productoId": 3, "cantidad": 4 }
  ],
  "merma": 0.5,
  "motivo": "Desposte del lote recibido",
  "usuarioId": 1
}
```

Origen y derivados deben ser productos activos medidos en kilos. Los derivados deben ser distintos entre sí y del origen. La suma de derivados y merma debe coincidir con el origen, con tolerancia de 0.000001 kg para los campos FLOAT existentes. La merma se descuenta una sola vez. La operación retorna `operacionId`, `movimientos` y `merma`; todos los movimientos incluyen `DESP:<operacionId>:E/I/M` en su motivo para agrupar origen, derivados y merma sin modificar el esquema existente.

## Compras y reposición

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/compras` | Historial paginado con filtros |
| GET | `/api/compras/reposicion` | Productos que necesitan reposición |
| GET | `/api/compras/:id` | Compra con detalles y cuenta corriente |
| POST | `/api/compras` | Registrar compra y generar cuenta pendiente |

`GET /api/compras` admite `proveedorId`, `estado` (`PENDIENTE_RECEPCION` o `RECIBIDA`), `fechaDesde`, `fechaHasta`, `page` y `limite`. Devuelve un array y publica el total en `X-Total-Count`.

`GET /api/compras/reposicion` admite `proveedorId`, `q`, `incluirProximos`, `page` y `limite`. Solo incluye productos activos con `stockMinimo` configurado cuyo stock esté en el mínimo o por debajo. Con `incluirProximos=true` también incluye los que no superan el 120% del mínimo. Cada fila devuelve `stockActual`, `stockMinimo`, `estado`, `faltante`, `cantidadSugerida`, `unidadCompra`, `unidadVenta`, `factorConversion`, `costoActual` y `proveedores`.

```json
{
  "proveedorId": 5,
  "pedidoId": 3,
  "tipoComprobante": "FACTURA",
  "numeroComprobante": "A-0001-00012345",
  "fechaHora": "2026-11-02T12:00:00.000Z",
  "detalles": [
    { "productoId": 10, "cantidadPresentacion": 2, "factorConversion": 10, "costoPresentacion": 1500 },
    { "productoId": 11, "cantidad": 5.5, "costoUnitario": 1200 }
  ]
}
```

`tipoComprobante` admite `FACTURA`, `REMITO` u `OTRO`. `numeroComprobante` es opcional y único por proveedor y tipo de comprobante. Cada detalle requiere `costoUnitario` o `costoPresentacion`; si se usa una presentación, `cantidadBase = cantidadPresentacion * factorConversion` y `costoUnitario = costoPresentacion / factorConversion`, redondeado a centavos. El cliente no determina el total: se calcula en el servidor y no puede superar 99999999.99.

La compra nace en estado `PENDIENTE_RECEPCION` y crea una `CuentaProveedor` con estado `PAGO PENDIENTE`. Si se informa `pedidoId`, el pedido debe pertenecer al mismo proveedor y estar `PENDIENTE`; luego pasa a `FACTURADO`. `GET /api/compras/:id` devuelve `{ "compra": {...}, "cuenta": {...} }`.

## Pedidos de compra

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/pedidos` | Historial paginado con filtros |
| GET | `/api/pedidos/:id` | Pedido con sus detalles |
| POST | `/api/pedidos` | Registrar pedido |
| POST | `/api/pedidos/:id/cancelar` | Cancelar un pedido pendiente |

`GET /api/pedidos` admite `proveedorId`, `estado`, `fechaDesde`, `fechaHasta`, `page` y `limite`. Devuelve un array y publica el total en `X-Total-Count`.

```json
{
  "proveedorId": 5,
  "fechaHora": "2026-11-02T12:00:00.000Z",
  "observaciones": "Reposición semanal",
  "detalles": [
    { "productoId": 10, "cantidad": 2, "costoEstimado": 1500 },
    { "productoId": 11, "cantidad": 5.5, "costoEstimado": 1200 }
  ]
}
```

El pedido admite entre 1 y 100 detalles, sin repetir producto. Cada producto debe estar activo y asociado al proveedor mediante el catálogo. `costoEstimado` es opcional y vale 0 por defecto. El total estimado se calcula en el servidor.

Estados: `PENDIENTE`, `FACTURADO`, `CANCELADO` y `RECIBIDO`. Un pedido nace `PENDIENTE`; al facturarse pasa a `FACTURADO` y al recibirse a `RECIBIDO`. Solo puede cancelarse desde `PENDIENTE`; la cancelación responde con el pedido actualizado y no toca el stock.

## Recepciones

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/recepciones` | Historial paginado con filtros |
| GET | `/api/recepciones/:id` | Recepción con sus detalles |
| POST | `/api/recepciones` | Recibir una compra y actualizar stock |

`GET /api/recepciones` admite `compraId`, `proveedorId`, `fechaDesde`, `fechaHasta`, `page` y `limite`. Devuelve un array y publica el total en `X-Total-Count`.

```json
{
  "compraId": 7,
  "fechaHora": "2026-11-02T12:00:00.000Z",
  "observaciones": "Mercadería recibida completa",
  "usuarioId": 1,
  "detalles": [
    {
      "productoId": 10,
      "presentacion": "CAJON",
      "cantidadPresentacion": 2,
      "factorConversion": 10,
      "costoPresentacion": 1500
    }
  ]
}
```

Una compra solo puede recibirse una vez y debe estar en `PENDIENTE_RECEPCION`. La recepción debe incluir todos los productos de la compra, sin repetirlos. `presentacion` admite `UNIDAD`, `KILOS`, `CAJON`, `CAJA`, `BOLSA` o `BULTO`; si se omite, se deriva de `unidadCompra`. Cada detalle requiere `cantidadPresentacion` positiva y puede informar `factorConversion`, `costoUnitario` o `costoPresentacion`; si no informa costo, se conserva el costo del detalle de compra.

La cantidad recibida se convierte a la unidad base con `cantidadPresentacion * factorConversion`. Si difiere de la cantidad comprada en más de 0.001 y no hay observaciones, la operación se rechaza. Al confirmar, se crea la recepción, se registran ingresos de stock con motivo `RECEPCION`, se actualiza `productos.costoActual` con el último costo unitario, la compra pasa a `RECIBIDA` y, si tiene pedido asociado, el pedido pasa a `RECIBIDO`. Todo se ejecuta en una única transacción.

## Consultas, transacciones y pruebas

Las consultas paginadas aceptan `page` (desde 1) y `limite` (1 a 1000, predeterminado 50). Búsquedas e historiales devuelven `{ "rows": [...], "count": ... }`. `/api/stock` conserva una respuesta de array y expone el total mediante `X-Total-Count`. Los endpoints de proveedores, productos, pedidos, compras, recepciones, cuentas y pagos conservan respuestas de array cuando no usan el contrato paginado.

Ventas, movimientos, pedidos, compras y recepciones admiten `fechaDesde`/`fechaHasta` como fechas ISO 8601 incluidas en el rango; una fecha sin hora se interpreta como medianoche UTC. Para abarcar un día completo, enviar el inicio y final con hora y zona.

Los productos se bloquean en orden de ID para serializar modificaciones de stock y reducir interbloqueos. Ventas, fraccionamientos, compras y recepciones se ejecutan en una única transacción: cualquier falla revierte todos sus cambios. No se mantienen transacciones abiertas entre solicitudes HTTP.

La autenticación de usuarios todavía queda fuera de alcance. Se conserva el usuario predeterminado 1 del modelo existente; el `usuarioId` enviado en ventas, movimientos y recepciones todavía no representa una identidad autenticada.

Las migraciones `productCatalog`, `preciosOfertas` y `comprasSprint4` se ejecutan al iniciar el servidor. La migración del Sprint 4 es idempotente y crea las tablas de pedidos, detalles, recepciones, así como las columnas y restricciones nuevas de compras y movimientos de stock.

```sh
# Desde backend
npm run typecheck
npm run typecheck:tests
npm run test:all
npm run test:jest:coverage
# Desde database
npm run build
npm test
```

Las pruebas unitarias de backend no conectan a la base. Las pruebas de base usan transacciones con rollback para no dejar datos de prueba. La suite de database incluye `ventas.test.ts`, `test-repositories2.test.ts` y `comprasSprint4.test.ts`; todas aplican la migración del Sprint 4 antes de ejecutarse. Las secuencias de IDs de PostgreSQL pueden avanzar incluso con rollback.

El workflow `.github/workflows/backend.yml` compila ambas capas y ejecuta pruebas unitarias e integración en un PostgreSQL descartable en cada pull request y push a `main`/`master`. `TEST_DATABASE_SYNC=true` crea tablas sólo en esa base de CI; no configurarlo para la base compartida. Para impedir merges con pruebas fallidas, configurar este check como obligatorio en las reglas de la rama del repositorio.

Se alinearon las opciones de campos opcionales e índices del compilador del backend con las de `database`, manteniendo `strict: true`, porque ambos paquetes comparten fuentes TypeScript.

## Sprint 3: proveedores, cuentas y ofertas

El frontend usa las operaciones de proveedor detalladas en [docs/sprint-3.md](../docs/sprint-3.md). Las rutas genéricas existentes de catálogo, compras, cuentas y pagos se conservan por compatibilidad.

`POST /api/proveedores/:id/comprobantes` recibe `numeroComprobante`, `fecha` (YYYY-MM-DD), `total` y `claveOperacion` (UUID). Registra compra y deuda juntas, sin movimiento de inventario. El proveedor debe estar activo y tener cuenta corriente habilitada.

`POST /api/proveedores/:id/pagos` recibe `importe` y `claveOperacion`. Registra pago y aplicaciones en una sola transacción, bloqueando proveedor y cuentas. No admite sobrepago y cancela primero las compras más antiguas. Un reintento con la misma clave y los mismos datos devuelve la operación anterior. Es posible cancelar deudas de un proveedor inactivo sin perder el historial.

Las ofertas nuevas reciben `descuentoPorcentaje` y productos con `productoId`/`cantidad`. El servidor suma los precios vigentes de la lista seleccionada y aplica el descuento sobre el subtotal conjunto. Los importes se redondean mediante aritmética decimal. Las ofertas anteriores conservan su precio fijo mientras no se conviertan desde edición. Las ventas confirmadas conservan sus importes históricos.

El alta de producto admite omitir `code`: genera un código interno válido que mantiene la columna y su unicidad. No se elimina la columna de la base.

El arranque ejecuta las migraciones incrementales de proveedores y cuentas. Para comprobar migración, HTTP, asociaciones, pagos, rollback y cotización/venta con descuentos:

```sh
npm run typecheck
npm run typecheck:tests
npm run test:all
npm run test:integration:sprint3
```

La integración del Sprint 3 encierra también el DDL en una transacción exterior y la revierte al terminar. Puede adelantar secuencias de IDs, pero no conserva registros de prueba ni cambios de existencias.
