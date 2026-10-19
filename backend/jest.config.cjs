/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Acotado a tests/ a propósito: database/src/test/test-repositories.ts es un
  // script con tsx que escribe filas en la base real y no debe ser recolectado.
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  moduleFileExtensions: ['ts', 'js', 'json'],

  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      // CommonJS y no ESM: en ESM jest.mock() no hoistea con imports estáticos
      // y obligaría a jest.unstable_mockModule() + import() dinámico en cada
      // test. @swc/jest además no ata su versión a typescript, así que funciona
      // con el typescript@7 del proyecto (ts-jest exige <7).
    //
    // trampa: importar `jest` desde '@jest/globals' DESACTIVA el hoisting de
    // jest.mock() con este transform. Los imports estáticos corren antes de los
    // jest.mock(), se carga el módulo real y la suite falla con errores muy
    // confusos de Sequelize ("Cannot read properties of undefined"). Usar el
    // global `jest`, como hace app.test.ts.
      module: { type: 'commonjs' },
      jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
    }],
  },

  moduleNameMapper: {
    // El código fuente usa extensión .js en imports relativos (module: nodenext).
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Debe declararse ANTES que la regla general de abajo: moduleNameMapper toma
    // la primera clave que coincide y Object.keys respeta el orden de inserción.
    // El doble evita que database/src/config/database.ts corra `new Sequelize(...)`
    // (carga pg y abre un pool) al importar services/operaciones.ts. No hace falta
    // para evitar que entren credenciales reales: dotenv.config() no sobreescribe
    // variables ya definidas, asi que el DATABASE_URL de tests/setup.ts gana igual.
    '^polleria-database/config/database$': '<rootDir>/tests/mocks/configDatabase.ts',
    // polleria-database declara un exports map que apunta a .ts crudos. Se traduce
    // el specifier a la ruta real en ../database/src para no depender del exports map.
    '^polleria-database/(.*)$': '<rootDir>/../database/src/$1.ts',
  },

  setupFiles: ['<rootDir>/tests/setup.ts'],

  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts'],
  // server.ts es el entrypoint que abre la conexión real a la base al
  // importarse: no puede correr bajo Jest y siempre quedaría en 0%.
  coveragePathIgnorePatterns: ['<rootDir>/src/server.ts'],
};