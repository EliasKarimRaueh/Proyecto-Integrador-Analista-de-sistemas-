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
            CREATE TABLE IF NOT EXISTS pedidos_compra (
                id SERIAL PRIMARY KEY,
                "proveedorId" INTEGER NOT NULL REFERENCES proveedores(id),
                "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
                "totalEstimado" DECIMAL(12,2) NOT NULL DEFAULT 0,
                observaciones VARCHAR(300)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS detalles_pedido_compra (
                id SERIAL PRIMARY KEY,
                "pedidoId" INTEGER NOT NULL REFERENCES pedidos_compra(id),
                "productoId" INTEGER NOT NULL REFERENCES productos(id),
                cantidad FLOAT NOT NULL,
                "costoEstimado" DECIMAL(12,2) NOT NULL DEFAULT 0,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                UNIQUE ("pedidoId", "productoId")
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS detalles_compra (
                id SERIAL PRIMARY KEY,
                "compraId" INTEGER NOT NULL REFERENCES compras(id),
                "productoId" INTEGER NOT NULL REFERENCES productos(id),
                cantidad FLOAT NOT NULL,
                "costoUnitario" DECIMAL(12,2) NOT NULL DEFAULT 0,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                presentacion VARCHAR(20),
                "cantidadPresentacion" FLOAT,
                "factorConversion" FLOAT,
                UNIQUE ("compraId", "productoId")
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS recepciones (
                id SERIAL PRIMARY KEY,
                "compraId" INTEGER NOT NULL UNIQUE REFERENCES compras(id),
                "pedidoId" INTEGER REFERENCES pedidos_compra(id),
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
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "numeroComprobante" VARCHAR(50)');
        await query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS estado VARCHAR(20)');
        await query("UPDATE compras SET estado = 'RECIBIDA' WHERE estado IS NULL");
        await query("ALTER TABLE compras ALTER COLUMN estado SET DEFAULT 'PENDIENTE_RECEPCION'");
        await query('ALTER TABLE compras ALTER COLUMN estado SET NOT NULL');

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'compras_pedido_fk'
                ) THEN
                    ALTER TABLE compras
                    ADD CONSTRAINT compras_pedido_fk
                    FOREIGN KEY ("pedidoId") REFERENCES pedidos_compra(id);
                END IF;
            END $$;
        `);

        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS compras_comprobante_unique
            ON compras ("proveedorId", "tipoComprobante", "numeroComprobante")
            WHERE "numeroComprobante" IS NOT NULL
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
