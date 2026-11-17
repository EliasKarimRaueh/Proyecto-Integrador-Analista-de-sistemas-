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

        // 1. Elimina la columna id muerta sólo si existe y garantiza la PK compuesta.
        await query(`
            DO $$
            DECLARE
                pk_name text;
                pk_cols text[];
                tiene_id boolean;
                tiene_numero_item boolean;
                duplicados_pk integer;
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

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesPedido'
                       AND column_name = 'id'
                ) INTO tiene_id;

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesPedido'
                       AND column_name = 'numeroItem'
                ) INTO tiene_numero_item;

                SELECT COUNT(*) INTO duplicados_pk FROM (
                    SELECT "pedidoId", "numeroItem"
                      FROM "detallesPedido"
                     GROUP BY "pedidoId", "numeroItem"
                    HAVING COUNT(*) > 1 OR "pedidoId" IS NULL OR "numeroItem" IS NULL
                ) t;

                IF pk_cols = ARRAY['id'] AND tiene_numero_item AND duplicados_pk = 0 THEN
                    EXECUTE format(
                        'ALTER TABLE %I DROP CONSTRAINT %I',
                        'detallesPedido',
                        pk_name
                    );
                    pk_cols := NULL;
                END IF;

                IF tiene_id AND pk_cols IS DISTINCT FROM ARRAY['id'] THEN
                    ALTER TABLE "detallesPedido" DROP COLUMN IF EXISTS id;
                END IF;

                IF pk_cols IS NULL
                   AND tiene_numero_item
                   AND duplicados_pk = 0
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
                tiene_id boolean;
                tiene_numero_item boolean;
                tiene_importe_unitario boolean;
                tiene_costo_unitario boolean;
                duplicados_pk integer;
                sin_importe integer;
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

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'id'
                ) INTO tiene_id;

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'numeroItem'
                ) INTO tiene_numero_item;

                SELECT COUNT(*) INTO duplicados_pk FROM (
                    SELECT "compraId", "numeroItem"
                      FROM "detallesCompra"
                     GROUP BY "compraId", "numeroItem"
                    HAVING COUNT(*) > 1 OR "compraId" IS NULL OR "numeroItem" IS NULL
                ) t;

                IF pk_cols = ARRAY['id'] AND tiene_numero_item AND duplicados_pk = 0 THEN
                    EXECUTE format(
                        'ALTER TABLE %I DROP CONSTRAINT %I',
                        'detallesCompra',
                        pk_name
                    );
                    pk_cols := NULL;
                END IF;

                IF tiene_id AND pk_cols IS DISTINCT FROM ARRAY['id'] THEN
                    ALTER TABLE "detallesCompra" DROP COLUMN IF EXISTS id;
                END IF;

                IF pk_cols IS NULL
                   AND tiene_numero_item
                   AND duplicados_pk = 0
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

                -- La columna vieja costoUnitario sólo se elimina si existe, ya existe
                -- importeUnitario y ninguna fila perdería datos no migrados.
                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'importeUnitario'
                ) INTO tiene_importe_unitario;

                SELECT EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'detallesCompra'
                       AND column_name = 'costoUnitario'
                ) INTO tiene_costo_unitario;

                IF tiene_importe_unitario AND tiene_costo_unitario THEN
                    EXECUTE 'SELECT COUNT(*) FROM "detallesCompra" WHERE "importeUnitario" IS NULL AND "costoUnitario" IS NOT NULL' INTO sin_importe;
                    IF sin_importe = 0 THEN
                        ALTER TABLE "detallesCompra"
                            DROP COLUMN IF EXISTS "costoUnitario";
                    ELSE
                        RAISE WARNING 'detallesCompra tiene % filas con costoUnitario sin importeUnitario; se conserva costoUnitario.', sin_importe;
                    END IF;
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

        // 4. Alinea defaults y tipos con los modelos sin truncar ni sobreescribir datos válidos.
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
                ) AND EXISTS (
                    SELECT 1 FROM pedidos WHERE estado = 'PENDIENTE'
                ) THEN
                    UPDATE pedidos p
                       SET estado = 'REALIZADO'
                     WHERE p.estado = 'PENDIENTE'
                       AND NOT EXISTS (
                           SELECT 1 FROM recepciones r WHERE r."pedidoId" = p.id
                       );
                END IF;
            END $$;
        `);

        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS total NUMERIC(12,2)');
        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "usuarioRecepcion" BIGINT');
        await query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "fechaHoraRecepcion" TIMESTAMP WITH TIME ZONE');

        await query(`
            DO $$
            DECLARE
                len_obs integer;
                max_obs integer;
                len_comp integer;
                max_comp integer;
            BEGIN
                SELECT character_maximum_length INTO len_obs
                  FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'observaciones';
                IF len_obs IS DISTINCT FROM 300 THEN
                    SELECT COALESCE(MAX(LENGTH(observaciones)), 0) INTO max_obs FROM pedidos;
                    IF max_obs <= 300 THEN
                        ALTER TABLE pedidos ALTER COLUMN observaciones TYPE VARCHAR(300);
                    END IF;
                END IF;

                SELECT character_maximum_length INTO len_comp
                  FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'numeroComprobante';
                IF len_comp IS DISTINCT FROM 80 THEN
                    SELECT COALESCE(MAX(LENGTH("numeroComprobante")), 0) INTO max_comp FROM compras;
                    IF max_comp <= 80 THEN
                        ALTER TABLE compras ALTER COLUMN "numeroComprobante" TYPE VARCHAR(80);
                    END IF;
                END IF;
            END $$;
        `);

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
