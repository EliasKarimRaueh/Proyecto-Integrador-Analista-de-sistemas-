// Doble de prueba de polleria-database/config/database.
//
// Existe para que services/operaciones.ts no ejecute `new Sequelize(...)` al
// importarse: eso carga el driver pg y reserva un pool aunque la suite nunca
// consulte nada.
//
// Ojo con el alcance: esto NO protege de una fuga de credenciales.
// database/src/config/database.ts:8 llama a dotenv.config() con el .env de la raíz,
// pero dotenv.config() no sobreescribe variables ya definidas, así que el
// DATABASE_URL que fija tests/setup.ts sigue ganando. Lo que sí evita es que la
// suite dependa de la configuración local de la máquina.
//
// El `transaction` es un jest.fn() sin implementación: cada test define la suya
// en beforeEach para poder afirmar que la transacción se propaga a los
// repositorios (ver helpers/transaccion.ts).

export const sequelize = {
  transaction: jest.fn(),
};

export default sequelize;