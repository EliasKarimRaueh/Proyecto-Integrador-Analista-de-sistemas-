import sequelize from "../config/database.js";

try {
    await sequelize.authenticate();

    console.log("✅ Conexión exitosa con Supabase");
} catch (error) {
    console.error("❌ Error de conexión con Supabase:");
    console.error(error);
} finally {
    await sequelize.close();
}