import sequelize from '../config/database.js';

/**
 * Migración idempotente y no destructiva de usuarios y sesiones.
 *
 * Es el equivalente en TypeScript de `sql/usuarios_supabase.sql`; usa los
 * mismos nombres de índice para no duplicar los que ya creó el SQL en Supabase.
 * No instala pgcrypto ni usa gen_random_uuid(): los jti los genera la app.
 * Tampoco crea FOREIGN KEY hacia usuarios, para no invalidar los ids históricos.
 * Sólo crea lo que falta, rellena "usuarioId" nulos con 1 y alinea la secuencia.
 */
export async function migrateUsuarios() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });

        await query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                "passwordHash" VARCHAR(255) NOT NULL,
                rol VARCHAR(20) NOT NULL DEFAULT 'EMPLEADO'
                    CHECK (rol IN ('PROPIETARIO', 'EMPLEADO')),
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "fechaActualizacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "ultimoAcceso" TIMESTAMPTZ
            )
        `);

        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_idx
            ON usuarios (lower(email))
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS sesiones_usuario (
                id SERIAL PRIMARY KEY,
                jti UUID NOT NULL UNIQUE,
                "usuarioId" INTEGER NOT NULL,
                "creadaEn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "expiraEn" TIMESTAMPTZ NOT NULL,
                "revocadaEn" TIMESTAMPTZ
            )
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS sesiones_usuario_usuario_id_idx
            ON sesiones_usuario ("usuarioId")
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS sesiones_usuario_expira_en_idx
            ON sesiones_usuario ("expiraEn")
        `);

        // Usuario histórico: Dueño = 1 en los comprobantes anteriores al módulo.
        // '!sin-acceso' no es un hash verificable: nadie puede iniciar sesión.
        await query(`
            INSERT INTO usuarios (
                id, nombre, apellido, email, "passwordHash", rol, activo,
                "fechaCreacion", "fechaActualizacion"
            )
            SELECT
                1, 'Usuario', 'Histórico', 'historico@polleria.invalid',
                '!sin-acceso', 'EMPLEADO', FALSE, NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE id = 1)
        `);

        // setval seguro: si la tabla vino de otro esquema sin secuencia, no falla.
        await query(`
            DO $$
            DECLARE
                seq text := pg_get_serial_sequence('usuarios', 'id');
            BEGIN
                IF seq IS NOT NULL THEN
                    PERFORM setval(
                        seq::regclass,
                        GREATEST(COALESCE((SELECT MAX(id) FROM usuarios), 1), 1),
                        true
                    );
                END IF;
            END $$
        `);

        await query('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER');
        await query('UPDATE ventas SET "usuarioId" = 1 WHERE "usuarioId" IS NULL');
        await query('ALTER TABLE ventas ALTER COLUMN "usuarioId" SET DEFAULT 1');
        await query('ALTER TABLE ventas ALTER COLUMN "usuarioId" SET NOT NULL');
        await query('CREATE INDEX IF NOT EXISTS ventas_usuario_id_idx ON ventas ("usuarioId")');

        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER');
        await query('UPDATE compras SET "usuarioId" = 1 WHERE "usuarioId" IS NULL');
        await query('ALTER TABLE compras ALTER COLUMN "usuarioId" SET DEFAULT 1');
        await query('ALTER TABLE compras ALTER COLUMN "usuarioId" SET NOT NULL');
        await query('CREATE INDEX IF NOT EXISTS compras_usuario_id_idx ON compras ("usuarioId")');

        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER');
        await query('UPDATE pedidos SET "usuarioId" = 1 WHERE "usuarioId" IS NULL');
        await query('ALTER TABLE pedidos ALTER COLUMN "usuarioId" SET DEFAULT 1');
        await query('ALTER TABLE pedidos ALTER COLUMN "usuarioId" SET NOT NULL');
        await query('CREATE INDEX IF NOT EXISTS pedidos_usuario_id_idx ON pedidos ("usuarioId")');

        // Pagos also belong to the authenticated operator. DEFAULT avoids a
        // full-table rewrite when adding NOT NULL on existing installations.
        await query('ALTER TABLE pagos ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER');
        await query('UPDATE pagos SET "usuarioId" = 1 WHERE "usuarioId" IS NULL');
        await query('ALTER TABLE pagos ALTER COLUMN "usuarioId" SET DEFAULT 1');
        await query('ALTER TABLE pagos ALTER COLUMN "usuarioId" SET NOT NULL');
        await query('CREATE INDEX IF NOT EXISTS pagos_usuario_id_idx ON pagos ("usuarioId")');
    });
}
