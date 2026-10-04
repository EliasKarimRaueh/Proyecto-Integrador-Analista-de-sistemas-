# Backend de AvixSoft — Sprint 2

Desde `database`, instalar dependencias con `npm ci`. Guardar la conexión provista en `database/.env` como `DATABASE_URL=postgresql://...`. Desde `backend`, ejecutar `npm ci` y `npm run dev`. En PowerShell con scripts deshabilitados usar `npm.cmd`.

Supabase utiliza SSL por defecto. Para PostgreSQL local configurar `DATABASE_SSL=false`. `SQL_LOG=true` habilita el registro de consultas. El puerto predeterminado es 3000; `PORT` permite cambiarlo.

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

## Consultas, transacciones y pruebas

Las consultas paginadas aceptan `page` (desde 1) y `limite` (1 a 1000, predeterminado 50). Búsquedas e historiales devuelven `{ "rows": [...], "count": ... }`. `/api/stock` conserva una respuesta de array y expone el total mediante `X-Total-Count`.

Ventas y movimientos admiten `fechaDesde`/`fechaHasta` como fechas ISO 8601 incluidas en el rango; una fecha sin hora se interpreta como medianoche UTC. Para abarcar un día completo, enviar el inicio y final con hora y zona. Movimientos admite además `productoId`, `ventaId`, `tipo=INGRESO|EGRESO` y `operacionId` de un desposte.

Los productos se bloquean en orden de ID para serializar modificaciones de stock y reducir interbloqueos. Ventas y fraccionamientos se ejecutan en una única transacción: cualquier falla revierte venta, detalles, stock y movimientos. No se mantienen transacciones abiertas entre solicitudes HTTP.

La autenticación de usuarios queda fuera del Sprint 2. Se conserva el usuario predeterminado 1 del modelo existente; el `usuarioId` enviado todavía no representa una identidad autenticada. Las ventas no tienen cancelación posterior ni idempotencia en este alcance.

```sh
# Desde backend
npm run typecheck
npm test
npm run test:integration
# Desde database
npx tsc --noEmit
```

Las pruebas unitarias no conectan a la base. Las de integración usan fixtures temporales y savepoints dentro de una transacción que se revierte al finalizar; no guardan ventas ni alteran productos existentes. Las secuencias de IDs de PostgreSQL pueden avanzar incluso con rollback. No se ejecuta el antiguo test `database/src/test/ventas.test.ts`, que usa productos del seed y realiza operaciones sobre ellos.

El workflow `.github/workflows/backend.yml` compila ambas capas y ejecuta pruebas unitarias e integración en un PostgreSQL descartable en cada pull request y push a `main`/`master`. `TEST_DATABASE_SYNC=true` crea tablas sólo en esa base de CI; no configurarlo para la base compartida. Para impedir merges con pruebas fallidas, configurar este check como obligatorio en las reglas de la rama del repositorio.

Se alinearon las opciones de campos opcionales e índices del compilador del backend con las de `database`, manteniendo `strict: true`, porque ambos paquetes comparten fuentes TypeScript.
