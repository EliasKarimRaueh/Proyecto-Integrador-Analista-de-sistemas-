import sequelize from '../config/database.js';

/**
 * Deja precios, ofertas y ofertas_productos con la estructura que
 * espera el código de dominio: baja lógica en las tres tablas y un
 * índice que impide tener dos precios abiertos para el mismo producto.
 *
 * Asume que las tres tablas ya existen, igual que migrateProductCatalog
 * asume que productos existe.
 */
export async function migratePreciosOfertas() {
    await sequelize.transaction(async transaction => {

        // ofertas_productos nació con la columna en minúsculas. PostgreSQL
        // no tiene RENAME COLUMN IF EXISTS, así que el rename va dentro de
        // un bloque que consulta el catálogo. Hay que cubrir los tres
        // casos: solo la vieja (base vieja), solo la nueva (base ya
        // migrada) y las dos a la vez, que si se intentara renombrar
        // abortaría toda la migración con "column already exists".
        await sequelize.query(
            `DO $$
            DECLARE
                hay_vieja BOOLEAN;
                hay_nueva BOOLEAN;
            BEGIN
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'ofertas_productos'
                      AND column_name = 'fechabaja'
                ) INTO hay_vieja;

                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'ofertas_productos'
                      AND column_name = 'fechaBaja'
                ) INTO hay_nueva;

                IF hay_vieja AND NOT hay_nueva THEN
                    EXECUTE 'ALTER TABLE ofertas_productos RENAME COLUMN "fechabaja" TO "fechaBaja"';
                ELSIF hay_vieja AND hay_nueva THEN
                    EXECUTE 'UPDATE ofertas_productos SET "fechaBaja" = "fechabaja" WHERE "fechaBaja" IS NULL';
                    EXECUTE 'ALTER TABLE ofertas_productos DROP COLUMN "fechabaja"';
                END IF;
            END $$`,
            { transaction }
        );

        await sequelize.query(
            'ALTER TABLE precios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true',
            { transaction }
        );

        await sequelize.query(
            'ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true',
            { transaction }
        );

        await sequelize.query(
            'ALTER TABLE ofertas_productos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true',
            { transaction }
        );

        await sequelize.query(
            'ALTER TABLE ofertas_productos ADD COLUMN IF NOT EXISTS "fechaBaja" TIMESTAMPTZ NULL',
            { transaction }
        );

        await sequelize.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS oferta_producto_unico ON ofertas_productos ("ofertaId", "productoId")',
            { transaction }
        );

        // Un solo precio abierto por producto. El índice es parcial: solo
        // mira las filas que siguen vigentes, así el historial puede tener
        // todos los precios cerrados que quiera.
        await sequelize.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS precios_unico_abierto
             ON precios ("productoId")
             WHERE "fechaHasta" IS NULL AND "fechaBaja" IS NULL`,
            { transaction }
        );
    });
}
