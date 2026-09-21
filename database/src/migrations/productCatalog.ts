import sequelize from '../config/database.js';

/** Mantiene compatible la tabla existente con los campos editables del catálogo. */
export async function migrateProductCatalog() {
    await sequelize.transaction(async transaction => {
        await sequelize.query(
            'ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo VARCHAR(20)',
            { transaction }
        );
        await sequelize.query(
            `UPDATE productos
             SET codigo = 'PRO-' || LPAD(id::text, 3, '0')
             WHERE codigo IS NULL OR BTRIM(codigo) = ''`,
            { transaction }
        );
        await sequelize.query(
            'ALTER TABLE productos ALTER COLUMN codigo SET NOT NULL',
            { transaction }
        );
        await sequelize.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_unique ON productos (UPPER(codigo))',
            { transaction }
        );
        await sequelize.query(
            `ALTER TABLE productos
             ADD COLUMN IF NOT EXISTS descripcion VARCHAR(300) NOT NULL DEFAULT ''`,
            { transaction }
        );
    });
}
