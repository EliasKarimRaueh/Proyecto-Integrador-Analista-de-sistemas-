// Corre antes de que se cargue cualquier archivo de test.
//
// database/src/config/database.ts lanza "DATABASE_URL no está definida" al
// evaluarse, y todos los repositorios lo importan en transitividad a través de
// los modelos. En los tests de controladores y de API los repositorios van
// mockeados, así que nunca se carga; esto queda como red de seguridad para
// cualquier test futuro que importe un modelo de verdad.
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/polleria_test';
process.env.NODE_ENV ??= 'test';

// Los tests de negocio existentes no negocian tokens: el middleware de auth
// acepta este bypass explícito sólo bajo NODE_ENV=test. Los tests de auth lo
// desactivan en su propio beforeEach.
process.env.AUTH_BYPASS ??= 'true';
process.env.AUTH_BYPASS_ID ??= '2';
process.env.JWT_SECRET ??= 'test-access-secret-con-al-menos-32-caracteres';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-con-al-menos-32-caracteres';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_DIAS ??= '1';
process.env.JWT_REFRESH_DIAS_RECORDARME ??= '7';
process.env.COOKIE_SECURE ??= 'false';
