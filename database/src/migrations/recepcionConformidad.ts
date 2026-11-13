import sequelize from '../config/database.js';

/**
 * Recepción con conformidad.
 *
 * Registra qué llegó realmente de una compra: además de la cantidad
 * aceptada (que ya vive en `detalles_recepcion.cantidadBase`), guarda la
 * cantidad rechazada (mercadería vencida o dañada) y la faltante (producto
 * que no llegó o llegó de menos), con el motivo de la diferencia. En
 * `recepciones` agrega la conformidad global (COMPLETA / CON_DIFERENCIAS).
 *
 * Es idempotente y transaccional: puede ejecutarse en cada arranque.
 */
export async function migrateRecepcionConformidad() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });

        await query('ALTER TABLE detalles_recepcion ADD COLUMN IF NOT EXISTS "cantidadRechazadaBase" FLOAT NOT NULL DEFAULT 0');
        await query('ALTER TABLE detalles_recepcion ADD COLUMN IF NOT EXISTS "cantidadFaltanteBase" FLOAT NOT NULL DEFAULT 0');
        await query('ALTER TABLE detalles_recepcion ADD COLUMN IF NOT EXISTS motivo VARCHAR(200)');
        await query("ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS conformidad VARCHAR(20) NOT NULL DEFAULT 'COMPLETA'");
    });
}
