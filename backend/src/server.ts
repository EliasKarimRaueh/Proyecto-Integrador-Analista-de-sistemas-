import 'dotenv/config';
import app from './app.js';
import sequelize from '../../database/src/config/database.js';

const PORT = process.env.PORT || 3000;

try {
  await sequelize.authenticate();
  console.log('Conexión exitosa con la base de datos');

  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('No se pudo conectar con la base de datos:', error);
  process.exit(1);
}
