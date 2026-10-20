import sequelize from '../config/database.js';
import Proveedor from '../models/Proveedor.js';
import ProductoProveedor from '../models/ProductoProveedor.js';
import Compra from '../models/Compra.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import Pago from '../models/Pago.js';
import PagoPorCuenta from '../models/PagoPorCuenta.js';

/** Crea únicamente tablas faltantes y amplía las existentes sin recrearlas. */
export async function migrateCuentasProveedores() {
    await sequelize.transaction(async transaction => {
        await sequelize.query('ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS "descuentoPorcentaje" NUMERIC(5,2) NULL CHECK ("descuentoPorcentaje" BETWEEN 0 AND 100)', { transaction });
        const opciones = { transaction, force: false };
        for (const model of [Proveedor, ProductoProveedor, Compra, CuentaProveedor, Pago, PagoPorCuenta]) await model.sync(opciones);
        await sequelize.query('ALTER TABLE compras ADD COLUMN IF NOT EXISTS "numeroComprobante" VARCHAR(80), ADD COLUMN IF NOT EXISTS "claveOperacion" UUID', { transaction });
        await sequelize.query('ALTER TABLE pagos ADD COLUMN IF NOT EXISTS "claveOperacion" UUID', { transaction });
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS compras_clave_operacion ON compras ("claveOperacion")', { transaction });
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS pagos_clave_operacion ON pagos ("claveOperacion")', { transaction });
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS compras_proveedor_comprobante ON compras ("proveedorId", "numeroComprobante") WHERE "numeroComprobante" IS NOT NULL', { transaction });
    });
}
