import sequelize from '../config/database.js';

/**
 * Limpieza del esquema de pedidos/compras.
 *
 * Elimina los restos que quedaron de versiones anteriores del esquema:
 * - Columnas `id` muertas en `detallesPedido` y `detallesCompra` (la PK real
 *   es compuesta: padre + `numeroItem`).
 * - Índices/constraints únicos duplicados sobre las mismas columnas.
 * - Defaults y tipos desalineados con los modelos.
 *
 * Es idempotente y transaccional: puede ejecutarse en cada arranque.
 */
export async function migrateLimpiezaEsquema() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });

        // 1. Elimina la columna id muerta y garantiza la PK compuesta.
        await query(`
            DO $$
            DECLARE
                pk_name text;
                pk_cols text[];
                tiene_numero_item boolean;
            BEGIN
                SELECT c.conname,
                       array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
                  INTO pk_name, pk_cols
                  FROM pg_constraint c
                  JOIN pg_attribute a
                    ON a.attrelid = c.conrelid
                   AND a.attnum = ANY(c.conkey)
                 WHERE c.conrelid = to_regclass('public."detallesPedido"')
                   AND c.contype = 'p'
                 GROUP BY c.conname;

                IF pk_cols = ARRAY['id'] THEN
                    EXECUTE format(
                        'ALTER TABLE %I DROP CONSTRAINT %I',
                        'detallesPedido',
                        pk_name
                    );
                    pk_cols := NULL;
                END IF;

                ALTER TABLE "detallesPedido" DROP COLUMN IF EXISTS id;

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesPedido'
                       AND column_name = 'numeroItem'
                ) INTO tiene_numero_item;

                IF pk_cols IS NULL
                   AND tiene_numero_item
                   AND NOT EXISTS (
                       SELECT 1
                         FROM pg_constraint
                        WHERE conrelid = to_regclass('public."detallesPedido"')
                          AND contype = 'p'
                   )
                THEN
                    ALTER TABLE "detallesPedido"
                        ADD CONSTRAINT "detallesPedido_pkey"
                        PRIMARY KEY ("pedidoId", "numeroItem");
                END IF;
            END $$;
        `);

        await query(`
            DO $$
            DECLARE
                pk_name text;
                pk_cols text[];
                tiene_numero_item boolean;
                tiene_importe_unitario boolean;
            BEGIN
                SELECT c.conname,
                       array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
                  INTO pk_name, pk_cols
                  FROM pg_constraint c
                  JOIN pg_attribute a
                    ON a.attrelid = c.conrelid
                   AND a.attnum = ANY(c.conkey)
                 WHERE c.conrelid = to_regclass('public."detallesCompra"')
                   AND c.contype = 'p'
                 GROUP BY c.conname;

                IF pk_cols = ARRAY['id'] THEN
                    EXECUTE format(
                        'ALTER TABLE %I DROP CONSTRAINT %I',
                        'detallesCompra',
                        pk_name
                    );
                    pk_cols := NULL;
                END IF;

                ALTER TABLE "detallesCompra" DROP COLUMN IF EXISTS id;

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'numeroItem'
                ) INTO tiene_numero_item;

                IF pk_cols IS NULL
                   AND tiene_numero_item
                   AND NOT EXISTS (
                       SELECT 1
                         FROM pg_constraint
                        WHERE conrelid = to_regclass('public."detallesCompra"')
                          AND contype = 'p'
                   )
                THEN
                    ALTER TABLE "detallesCompra"
                        ADD CONSTRAINT "detallesCompra_pkey"
                        PRIMARY KEY ("compraId", "numeroItem");
                END IF;

                -- La columna vieja costoUnitario sólo se elimina cuando ya
                -- existe importeUnitario, para no perder datos.
                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'importeUnitario'
                ) INTO tiene_importe_unitario;

                IF tiene_importe_unitario THEN
                    ALTER TABLE "detallesCompra"
                        DROP COLUMN IF EXISTS "costoUnitario";
                END IF;
            END $$;
        `);

        // 2. Elimina las unicidades viejas de producto por documento.
        await query('ALTER TABLE "detallesPedido" DROP CONSTRAINT IF EXISTS "detallesPedido_pedidoId_productoId_key"');
        await query('DROP INDEX IF EXISTS "detallesPedido_pedidoId_productoId_key"');
        await query('ALTER TABLE "detallesCompra" DROP CONSTRAINT IF EXISTS "detallesCompra_compraId_productoId_key"');
        await query('DROP INDEX IF EXISTS "detallesCompra_compraId_productoId_key"');

        // 3. Conserva un único índice por unicidad y elimina los duplicados.
        await query('CREATE UNIQUE INDEX IF NOT EXISTS compras_clave_operacion ON compras ("claveOperacion")');
        await query('CREATE UNIQUE INDEX IF NOT EXISTS pagos_clave_operacion ON pagos ("claveOperacion")');
        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS compras_pedido_unique
            ON compras ("pedidoId")
            WHERE "pedidoId" IS NOT NULL
        `);
        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS compras_comprobante_tipo
            ON compras ("proveedorId", COALESCE("tipoComprobante", 'OTRO'), "numeroComprobante")
            WHERE "numeroComprobante" IS NOT NULL
        `);
        await query('CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_unique ON productos (UPPER(codigo))');

        await query('ALTER TABLE compras DROP CONSTRAINT IF EXISTS "compras_claveOperacion_key"');
        await query('ALTER TABLE pagos DROP CONSTRAINT IF EXISTS "pagos_claveOperacion_key"');
        await query('ALTER TABLE compras DROP CONSTRAINT IF EXISTS "compras_pedidoId_key"');
        await query('ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_codigo_key');
        await query('DROP INDEX IF EXISTS compras_comprobante_unique');

        // 4. Alinea defaults y tipos con los modelos.
        await query("ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'REALIZADO'");

        await query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'pedidos'
                       AND column_name = 'estado'
                       AND data_type = 'character varying'
                ) THEN
                    UPDATE pedidos SET estado = 'REALIZADO' WHERE estado = 'PENDIENTE';
                END IF;
            END $$;
        `);

        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS total NUMERIC(12,2)');
        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "usuarioRecepcion" BIGINT');
        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "fechaHoraRecepcion" TIMESTAMP WITH TIME ZONE');
        await query('ALTER TABLE pedidos ALTER COLUMN observaciones TYPE VARCHAR(300)');
        await query('ALTER TABLE compras ALTER COLUMN "numeroComprobante" TYPE VARCHAR(80)');

        // Completa el total de pedidos viejos desde sus detalles y lo alinea
        // con el modelo (no nulo, con default 0).
        await query(`
            UPDATE pedidos p
               SET total = COALESCE(
                   (SELECT SUM(d.subtotal)
                      FROM "detallesPedido" d
                     WHERE d."pedidoId" = p.id),
                   0
               )
             WHERE p.total IS NULL
        `);
        await query('ALTER TABLE pedidos ALTER COLUMN total TYPE NUMERIC(12,2)');
        await query('ALTER TABLE pedidos ALTER COLUMN total SET DEFAULT 0');
        await query('ALTER TABLE pedidos ALTER COLUMN total SET NOT NULL');
    });
}
