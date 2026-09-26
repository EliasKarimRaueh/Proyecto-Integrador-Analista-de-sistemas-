import { Sequelize } from "sequelize";
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Carga el .env de la raíz del repo y permite sobreescribir con database/.env.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });


const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Necesario para la conexión externa a Supabase
        }
    },
    logging: console.log
});

export default sequelize;
