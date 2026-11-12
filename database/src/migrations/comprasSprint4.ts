import sequelize from '../config/database.js';

export async function migrateComprasSprint4() {
    await sequelize.transaction(async transaction => {
        const query = (sql: string) => sequelize.query(sql, { transaction });
        await query('ALTER TABLE ofertas ALTER COLUMN "fechaFin" DROP NOT NULL');
        await query('ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS "precioFinal" NUMERIC(12,2) CHECK ("precioFinal" > 0 AND "precioFinal" <= 99999999.99)');
        await query('ALTER TABLE "detallesVenta" ADD COLUMN IF NOT EXISTS despacho JSONB');

        await query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS "proveedorHabitualId" INTEGER REFERENCES proveedores(id)');
        await query('CREATE INDEX IF NOT EXISTS productos_proveedor_habitual ON productos ("proveedorHabitualId") WHERE "proveedorHabitualId" IS NOT NULL');
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS observaciones VARCHAR(300)');
        await query(`DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compras' AND column_name = 'formaPago') THEN
                ALTER TABLE compras ALTER COLUMN "formaPago" SET DEFAULT 'A CUENTA';
            END IF;
        END $$`);

        await query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                "proveedorId" INTEGER NOT NULL REFERENCES proveedores(id),
                "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                estado VARCHAR(20) NOT NULL DEFAULT 'REALIZADO',
                "totalEstimado" DECIMAL(12,2) NOT NULL DEFAULT 0,
                total DECIMAL(12,2) NOT NULL DEFAULT 0,
                "usuarioRecepcion" BIGINT,
                "fechaHoraRecepcion" TIMESTAMP WITH TIME ZONE,
                observaciones VARCHAR(300)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS "detallesPedido" (
                "pedidoId" INTEGER NOT NULL REFERENCES pedidos(id),
                "numeroItem" INTEGER NOT NULL,
                "productoId" INTEGER NOT NULL REFERENCES productos(id),
                cantidad FLOAT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                "unidadPedido" VARCHAR(255) NOT NULL,
                "importeUnitario" DECIMAL(12,2) NOT NULL,
                "costoEstimado" DECIMAL(12,2) NOT NULL DEFAULT 0,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                PRIMARY KEY ("pedidoId", "numeroItem")
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS "detallesCompra" (
                "compraId" INTEGER NOT NULL REFERENCES compras(id),
                "numeroItem" INTEGER NOT NULL,
                "pedidoId" INTEGER,
                "numeroItemPedido" INTEGER,
                "productoId" INTEGER NOT NULL REFERENCES productos(id),
                cantidad FLOAT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                "unidadCompra" VARCHAR(255) NOT NULL,
                "importeUnitario" DECIMAL(12,2) NOT NULL,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                presentacion VARCHAR(20),
                "cantidadPresentacion" FLOAT,
                "factorConversion" FLOAT,
                PRIMARY KEY ("compraId", "numeroItem")
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS recepciones (
                id SERIAL PRIMARY KEY,
                "compraId" INTEGER NOT NULL UNIQUE REFERENCES compras(id),
                "pedidoId" INTEGER REFERENCES pedidos(id),
                "proveedorId" INTEGER NOT NULL REFERENCES proveedores(id),
                "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                observaciones VARCHAR(300),
                "usuarioId" INTEGER NOT NULL DEFAULT 1
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS detalles_recepcion (
                id SERIAL PRIMARY KEY,
                "recepcionId" INTEGER NOT NULL REFERENCES recepciones(id),
                "productoId" INTEGER NOT NULL REFERENCES productos(id),
                presentacion VARCHAR(20) NOT NULL,
                "cantidadPresentacion" FLOAT NOT NULL,
                "factorConversion" FLOAT NOT NULL,
                "cantidadBase" FLOAT NOT NULL,
                "costoUnitario" DECIMAL(12,2),
                UNIQUE ("recepcionId", "productoId")
            )
        `);

        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "pedidoId" INTEGER');
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "tipoComprobante" VARCHAR(20)');
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "numeroComprobante" VARCHAR(80)');
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS estado VARCHAR(20)');
        await query("UPDATE compras SET estado = 'RECIBIDA' WHERE estado IS NULL");
        await query("ALTER TABLE compras ALTER COLUMN estado SET DEFAULT 'PENDIENTE_RECEPCION'");
        await query('ALTER TABLE compras ALTER COLUMN estado SET NOT NULL');

        // 1. Elimina cualquier clave foránea previa sobre compras.pedidoId que no apunte a pedidos
        await query(`
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (
                    SELECT tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu
                      ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_name = 'compras'
                      AND kcu.column_name = 'pedidoId'
                      AND ccu.table_name <> 'pedidos'
                ) LOOP
                    EXECUTE 'ALTER TABLE compras DROP CONSTRAINT ' || quote_ident(r.constraint_name);
                END LOOP;
            END $$;
        `);

        // 2. Limpia los pedidoId huérfanos que no existen en pedidos
        await query(`
            UPDATE compras
            SET "pedidoId" = NULL
            WHERE "pedidoId" IS NOT NULL
              AND "pedidoId" NOT IN (SELECT id FROM pedidos);
        `);

        // 3. Aplica la clave foránea hacia pedidos
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'compras_pedido_fk'
                ) THEN
                    ALTER TABLE compras
                    ADD CONSTRAINT compras_pedido_fk
                    FOREIGN KEY ("pedidoId") REFERENCES pedidos(id);
                END IF;
            END $$;
        `);

        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS compras_pedido_unique
            ON compras ("pedidoId")
            WHERE "pedidoId" IS NOT NULL
        `);

        await query('ALTER TABLE movimientos_stock ADD COLUMN IF NOT EXISTS "recepcionId" INTEGER');

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_stock_recepcion_fk'
                ) THEN
                    ALTER TABLE movimientos_stock
                    ADD CONSTRAINT movimientos_stock_recepcion_fk
                    FOREIGN KEY ("recepcionId") REFERENCES recepciones(id);
                END IF;
            END $$;
        `);
    });
}
