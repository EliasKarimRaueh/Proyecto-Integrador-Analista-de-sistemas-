import { Sequelize } from "sequelize";
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Carga el .env de la raíz del repo y permite sobreescribir con database/.env.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });


const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: process.env.DATABASE_SSL === 'false' ? false : {
            require: true,
            rejectUnauthorized: false // Necesario para la conexión externa a Supabase
        }
    },
    logging: process.env.SQL_LOG === 'true' ? console.log : false
});

export default sequelize;
