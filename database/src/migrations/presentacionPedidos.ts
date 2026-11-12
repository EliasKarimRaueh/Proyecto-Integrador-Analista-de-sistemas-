import sequelize from '../config/database.js';

/**
 * Presentación de los productos en pedidos.
 *
 * Guarda cómo se cargó cada línea del pedido (cajones, bolsas, kilos, etc.)
 * para poder mostrarla en el historial y precargar la compra sin perder la
 * presentación original.
 *
 * Las columnas son opcionales: los pedidos viejos siguen funcionando y se
 * interpretan en la unidad de venta del producto.
 *
 * Es idempotente y transaccional: puede ejecutarse en cada arranque.
 */
export async function migratePresentacionPedidos() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });

        await query('ALTER TABLE "detallesPedido" ADD COLUMN IF NOT EXISTS presentacion VARCHAR(20)');
        await query('ALTER TABLE "detallesPedido" ADD COLUMN IF NOT EXISTS "cantidadPresentacion" FLOAT');
        await query('ALTER TABLE "detallesPedido" ADD COLUMN IF NOT EXISTS "factorConversion" FLOAT');
    });
}
