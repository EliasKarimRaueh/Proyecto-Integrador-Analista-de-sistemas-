import sequelize from '../config/database.js';

/**
 * Alinea pedidos."fechaHoraRecepcion" con recepciones."fechaHora".
 *
 * La columna se creó como `timestamp without time zone`. Al leerla, el driver la
 * interpretaba como hora local (UTC-3), por lo que la UI mostraba la recepción
 * 3 horas adelantada. Se migra a `timestamptz` interpretando el valor guardado
 * como UTC y, además, se rellenan las filas existentes desde `recepciones`, que
 * es la fuente autoritativa.
 */
export async function migrateZonaHorariaRecepcion() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });

        // Idempotente: sólo convierte si la columna sigue siendo timestamp naive.
        await query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'pedidos'
                      AND column_name = 'fechaHoraRecepcion'
                      AND data_type = 'timestamp without time zone'
                ) THEN
                    ALTER TABLE pedidos
                    ALTER COLUMN "fechaHoraRecepcion" TYPE TIMESTAMP WITH TIME ZONE
                    USING "fechaHoraRecepcion" AT TIME ZONE 'UTC';
                END IF;
            END $$;
        `);

        // Backfill desde recepciones (timestamptz): corrige cualquier desfase previo.
        await query(`
            UPDATE pedidos p
               SET "fechaHoraRecepcion" = r."fechaHora"
              FROM recepciones r
             WHERE r."pedidoId" = p.id
               AND p."fechaHoraRecepcion" IS DISTINCT FROM r."fechaHora"
        `);
    });
}
