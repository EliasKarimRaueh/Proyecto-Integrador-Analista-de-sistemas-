-- ============================================================================
-- usuarios_supabase.sql
-- v1 (2026-11-25) — Usuarios, sesiones y trazabilidad de usuario en comprobantes
--
-- Versión versionada del SQL ya aplicado en Supabase. Idempotente y no
-- destructivo: sólo CREATE IF NOT EXISTS, backfill de NULL y ajuste de la
-- secuencia. No elimina tablas, columnas ni filas.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- Usuarios
-- ----------------------------------------------------------------------------

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
);

-- El login es case-insensitive: unicidad sobre email normalizado.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_idx
    ON usuarios (lower(email));

-- ----------------------------------------------------------------------------
-- Sesiones (JWT / refresh tokens)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sesiones_usuario (
    id SERIAL PRIMARY KEY,
    jti UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    "usuarioId" INTEGER NOT NULL,
    "creadaEn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiraEn" TIMESTAMPTZ NOT NULL,
    "revocadaEn" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sesiones_usuario_usuario_id_idx
    ON sesiones_usuario ("usuarioId");
CREATE INDEX IF NOT EXISTS sesiones_usuario_expira_en_idx
    ON sesiones_usuario ("expiraEn");

-- Nota: no se crea FK hacia usuarios. Las tablas de negocio históricas
-- ya existían antes de este módulo y sus ids se conservan tal cual.

-- ----------------------------------------------------------------------------
-- Usuario histórico id = 1 (registros anteriores al alta de usuarios)
-- passwordHash con prefijo '!' => no es un hash reversible ni verificable.
-- ----------------------------------------------------------------------------

INSERT INTO usuarios (
    id, nombre, apellido, email, "passwordHash", rol, activo,
    "fechaCreacion", "fechaActualizacion"
)
SELECT
    1, 'Usuario', 'Histórico', 'historico@polleria.invalid',
    '!sin-acceso', 'EMPLEADO', FALSE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE id = 1);

-- Secuencia alineada con el mayor id ( SERIAL creado arriba u otro ya existente ).
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
END $$;

-- ----------------------------------------------------------------------------
-- columna "usuarioId" en tablas históricas: backfill a 1, default y NOT NULL.
-- Sólo se actualizan las filas que aún no tienen usuario asignado.
-- ----------------------------------------------------------------------------

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;
UPDATE ventas SET "usuarioId" = 1 WHERE "usuarioId" IS NULL;
ALTER TABLE ventas ALTER COLUMN "usuarioId" SET DEFAULT 1;
ALTER TABLE ventas ALTER COLUMN "usuarioId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS ventas_usuario_id_idx ON ventas ("usuarioId");

ALTER TABLE compras ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;
UPDATE compras SET "usuarioId" = 1 WHERE "usuarioId" IS NULL;
ALTER TABLE compras ALTER COLUMN "usuarioId" SET DEFAULT 1;
ALTER TABLE compras ALTER COLUMN "usuarioId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS compras_usuario_id_idx ON compras ("usuarioId");

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;
UPDATE pedidos SET "usuarioId" = 1 WHERE "usuarioId" IS NULL;
ALTER TABLE pedidos ALTER COLUMN "usuarioId" SET DEFAULT 1;
ALTER TABLE pedidos ALTER COLUMN "usuarioId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS pedidos_usuario_id_idx ON pedidos ("usuarioId");

-- ----------------------------------------------------------------------------
-- v2 (2026-11-25) — Auditoría de pagos. Idempotente; sin FK hacia usuarios.
-- Ejecutar este bloque en Supabase o dejar que migrateUsuarios() lo aplique
-- al arrancar el backend. El DEFAULT 1 evita reescribir toda la tabla.
-- ----------------------------------------------------------------------------

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;
UPDATE pagos SET "usuarioId" = 1 WHERE "usuarioId" IS NULL;
ALTER TABLE pagos ALTER COLUMN "usuarioId" SET DEFAULT 1;
ALTER TABLE pagos ALTER COLUMN "usuarioId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS pagos_usuario_id_idx ON pagos ("usuarioId");
