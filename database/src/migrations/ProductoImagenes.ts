import sequelize from '../config/database.js';

/**
 * Agrega la foto del producto. Los bytes se guardan en la misma base que el
 * resto del dominio para no depender de un bucket externo, y quedan excluidos
 * de las lecturas de catálogo para no arrastrar el archivo en cada fila.
 *
 * Los nombres van entre comillas a propósito: PostgreSQL convierte a minúsculas
 * cualquier identificador sin comillas, así que `imagenNombre` sin comillas crea
 * una columna `imagennombre` que Sequelize nunca encuentra. Las columnas de una
 * sola palabra como `codigo` no sufrían el problema, por eso las migraciones
 * anteriores no lo delataban.
 */
export async function migrateProductoImagenes() {
    await sequelize.transaction(async transaction => {
        await sequelize.query(
            'ALTER TABLE productos ADD COLUMN IF NOT EXISTS "imagen" BYTEA',
            { transaction }
        );
        await sequelize.query(
            'ALTER TABLE productos ADD COLUMN IF NOT EXISTS "imagenNombre" VARCHAR(255)',
            { transaction }
        );
        await sequelize.query(
            'ALTER TABLE productos ADD COLUMN IF NOT EXISTS "imagenMime" VARCHAR(50)',
            { transaction }
        );
        await sequelize.query(
            'ALTER TABLE productos ADD COLUMN IF NOT EXISTS "imagenBytes" INTEGER',
            { transaction }
        );
        // Los cuatro campos se escriben siempre juntos. Sin esto podría quedar
        // metadata huérfana sin bytes, que es justo el estado que rompe la
        // descarga y el placeholder de la interfaz.
        await sequelize.query(
            `DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'productos_imagen_completa'
                ) THEN
                    ALTER TABLE productos ADD CONSTRAINT productos_imagen_completa
                    CHECK (
                        "imagen" IS NULL OR (
                            "imagenNombre" IS NOT NULL AND
                            "imagenMime" IS NOT NULL AND
                            "imagenBytes" IS NOT NULL
                        )
                    );
                END IF;
            END $$`,
            { transaction }
        );
    });
}
