import { Sequelize } from "sequelize";
import 'dotenv/config'; // Esto carga las variables del archivo .env


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