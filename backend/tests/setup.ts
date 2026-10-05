// Corre antes de que se cargue cualquier archivo de test.
//
// database/src/config/database.ts lanza "DATABASE_URL no está definida" al
// evaluarse, y todos los repositorios lo importan en transitividad a través de
// los modelos. En los tests de controladores y de API los repositorios van
// mockeados, así que nunca se carga; esto queda como red de seguridad para
// cualquier test futuro que importe un modelo de verdad.
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/polleria_test';
process.env.NODE_ENV ??= 'test';