import { Sequelize } from "sequelize";
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Carga database/.env primero y completa desde el .env de la raíz sin pisar
// variables ya presentes en process.env (e.g. tests o entorno de despliegue).
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });


const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    dialectOptions: {
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        connectionTimeoutMillis: 15000,
        ssl: process.env.DATABASE_SSL === 'false' ? false : {
            require: true,
            rejectUnauthorized: false // Necesario para la conexión externa a Supabase
        }
    },
    logging: process.env.SQL_LOG === 'true' ? console.log : false
});

export default sequelize;
