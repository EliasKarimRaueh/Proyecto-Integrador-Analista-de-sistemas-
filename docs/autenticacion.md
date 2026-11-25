# Trazabilidad de autenticación y usuarios (US 38–42)

Este documento relaciona los user stories entregados con el código final. El estado es el del commit que introdujo el módulo de autenticación y el cierre de pendientes.

## Decisión de seguridad

El login implementa **ROPC de primera parte** (`POST /api/auth/login`): es el equivalente al *Resource Owner Password Credentials grant* de OAuth 2.0, resuelto por esta API contra la tabla `usuarios`, sin proveedor de identidad externo. Las contraseñas se hashean con bcrypt; el access token se guarda en memoria en el cliente y el refresh token viaja en cookie `httpOnly`. Cada sesión tiene un `jti` en `sesiones_usuario` que se revoca al cerrar sesión, al dar de baja al usuario o al rotar el refresh.

No hay registro público: el Propietario crea las cuentas desde **Administración → Usuarios**. El alta por defecto es `EMPLEADO` activo; el rol se elige en el formulario. El usuario `id=1` se conserva inactivo para no romper la auditoría histórica.

## Matriz US → implementación

| US | Criterios principales | Implementación | Estado |
| --- | --- | --- | --- |
| **38** Iniciar y cerrar sesión | Identificador y contraseña obligatorios; valida existencia, estado activo y hash; permisos por rol; logout invalida el token; respuesta < 1.5 s | `backend/src/services/auth.ts`, `backend/src/controllers/authController.ts`, `backend/src/middlewares/auth.ts`, `frontend/src/features/auth/` | ✅ Login medido en 782 ms. Credenciales inválidas 401, usuario inactivo 403, sin token 401, logout 401 después de revocar. OAuth se resolvió como ROPC propio (ver decisión arriba). |
| **39** Registrar usuario | Nombre, apellido, email, contraseña y rol obligatorios; duplicado 409; hash bcrypt; activo por defecto | `backend/src/services/usuarios.ts`, `backend/src/routes/usuarioRoutes.ts`, `UsuariosPage.tsx` | ✅ Alta sólo del Propietario; validación de campos y de email duplicado (case-insensitive). |
| **40** Consultar usuario | Grilla con nombre, email, rol y estado; filtros y búsqueda en tiempo real; sin contraseñas ni hashes | `listarUsuarios`, `publicarUsuario`, `UsuariosPage.tsx` | ✅ Búsqueda por nombre/apellido/email y filtros por rol y estado, con estado vacío informativo. `passwordHash` nunca se publica. |
| **41** Modificar usuario | Editar datos, rol y contraseña opcional; identidad duplicada 409; bloquear quitar el rol al último propietario activo | `actualizarUsuario`, formulario de edición | ✅ Cambio Empleado ↔ Propietario permitido; nueva contraseña opcional; auto-baja de rol y último propietario bloqueados con 409. |
| **42** Registrar baja usuario | Baja lógica preservando historial; modal de confirmación; no auto-baja ni último propietario; reactivación; nombre visible en ventas históricas | `bajarUsuario`, `reactivarUsuario`, `ConfirmacionUsuarioModal`, `operacionesController.ts`, `SalesHistoryPage.tsx`, `Receipt.tsx` | ✅ Baja/reactivación y bloqueos verificados. ✅ El nombre del operador se conserva en `usuarioNombre` y se muestra en el historial y comprobante de ventas, incluso si la cuenta fue dada de baja. |

## Auditoría de operaciones

El operador se toma siempre de `req.usuario.id` (helper `operadorId(req)`); enviar `usuarioId` en el body se rechaza con 400. Quedan vinculadas: ventas, movimientos de stock, inventarios, desposte, pedidos, recepciones, compras y pagos. No se crearon foreign keys hacia `usuarios` para preservar los ids históricos.

Los comprobantes y listados enriquecen la respuesta con `usuarioNombre` de forma tolerante: si la tabla de usuarios no responde, el historial sigue funcionando.

## Migraciones

`migrateUsuarios()` se ejecuta al arrancar y es idempotente. El equivalente versionado para Supabase está en `database/sql/usuarios_supabase.sql`, incluido el bloque v2 que agrega `pagos."usuarioId"` con backfill a 1, `DEFAULT 1`, `NOT NULL` e índice. No elimina tablas, columnas ni filas.

## Verificación

- Backend: `npm run typecheck`, `npm run typecheck:tests` y `npm run test:jest -- --runInBand`. Los tests del módulo cubren login, refresh, logout, roles, CRUD de usuarios y rechazo de `usuarioId` en el body. Persisten fallen suites heredadas, documentadas en `CODE_REVIEW_REPORT.md`, ajenas a estos US.
- Frontend: `npm run build`, `npm run lint`, `npm test` (incluye `tests/auth.test.tsx`, `tests/usuarios.test.tsx` y `tests/ventasHistorial.test.tsx`).
- Integración real contra Supabase: login 782 ms, refresh/logout/revocación, 403 para Empleado en gestión y 200 en operación, duplicado 409, inactivo 403, auto-baja y último propietario 409.
