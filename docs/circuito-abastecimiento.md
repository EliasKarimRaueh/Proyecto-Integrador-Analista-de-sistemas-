# Pedido → Recepción → Compra

Los modelos de `database/src/models/` permanecen sin cambios. La adaptación de relaciones se concentra en `circuitoAbastecimientoRepository.ts`, porque los modelos locales todavía describen el circuito anterior.

## Cambio de BD a cargo de Jeremías

- `compras.recepcionId` referencia la recepción de origen.
- `recepciones.compraId` debe eliminarse o permitir NULL: el código nunca lo utiliza.
- `recepciones.pedidoId` identifica el pedido de origen y es obligatorio en la API.

El código no ejecuta esta modificación del esquema. Si faltan las condiciones anteriores, las altas devuelven 409 antes de guardar datos. La prueba de esquema consulta metadatos, sin modificar tablas.

## Comportamiento

1. El pedido usa su fecha por defecto y el costo actual del producto. Al pedir presentaciones de compra, convierte la cantidad usando el factor del producto.
2. La recepción bloquea el pedido, admite sobrantes y productos adicionales, registra las cantidades aceptadas y genera sus ingresos de stock con `recepcionId` y `compraId = NULL`. No genera deuda ni cambia costos.
3. La compra bloquea la recepción y relee su relación para impedir duplicados concurrentes. Copia cantidades y presentaciones aceptadas, recibe los costos totales y calcula el costo unitario. Completa `compraId` en los movimientos existentes, actualiza el costo de cada producto y genera deuda solamente si la forma de pago es `A CUENTA`.

Cada alta se realiza en una transacción. Una falla revierte cabecera, detalles, movimientos, costos y cuenta según corresponda. Las fechas de recepción y compra se toman del timestamp de la BD.

Los costos unitarios se redondean a dos decimales, conforme a las columnas actuales. El subtotal conserva exactamente el costo total ingresado; no se reconstruye multiplicando el costo unitario redondeado.

Las consultas vinculan compras y recepciones por `compras.recepcionId`, nunca por la relación inversa del esquema anterior. Los comprobantes históricos sin esta relación conservan sus datos y no reciben asociaciones inventadas.
