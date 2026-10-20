import sequelize from '../config/database.js';

/** Amplía proveedores existentes sin borrar datos ni relaciones. */
export async function migrateProveedores() {
    await sequelize.transaction(async transaction => {
        await sequelize.query(
            `ALTER TABLE proveedores
             ADD COLUMN IF NOT EXISTS direccion VARCHAR(200) NULL,
             ADD COLUMN IF NOT EXISTS "diasEntrega" VARCHAR(10)[] NOT NULL DEFAULT '{}'`,
            { transaction }
        );
    });
}
