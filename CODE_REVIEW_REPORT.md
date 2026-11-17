# Code Review & Remediation Report — Pollería La Nena (AvixSoft)

**Fecha:** 2026-11-16 (UTC 2026-11-17)  
**Alcance:** Revisión integral de arquitectura, base de datos (`database/`), API REST (`backend/`), integración con Vite (`frontend/`), conectividad con Supabase (`hrupbamnkiezrqzikjwd`) y remediación con preservación total de datos.

---

## 1. Resumen Ejecutivo y Análisis de Causa Raíz

### 1.1 Causa raíz de `http proxy error: AggregateError [ECONNREFUSED]` (`/api/health`, `/api/stock`, `/api/ventas`)
Al montar la ruta inicial `/` en el frontend (`frontend/src/shared/components/AppLayout.tsx:24` y `frontend/src/features/home/HomePage.tsx:18,20`), la SPA dispara inmediatamente peticiones `GET /api/health`, `GET /api/stock` y `GET /api/ventas` a través del proxy de Vite (`frontend/vite.config.ts:6-15`, regla `/api` en líneas `9-14`). El error `AggregateError [ECONNREFUSED]` se produjo por la combinación de tres factores:

1. **El servidor backend no estaba escuchando en el puerto `3000`:** `backend/src/server.ts:17-36` ejecuta `sequelize.authenticate()` y **9 migraciones DDL secuenciales** antes de invocar `app.listen(PORT)` (línea 30). Ante cualquier error de conexión o migración, ejecuta `process.exit(1)` (línea 35). Además, faltaba `backend/.env` en el repositorio local.
2. **Desalineación crítica entre el modelo `Producto` y la tabla viva `productos` en Supabase:** La inspección de `information_schema.columns` sobre Supabase reveló que el historial reciente (`647d424` / `1cd1244`) dejó en `productos` únicamente `"imagenNombre"` e `"imagenMime"`, **sin las columnas `"imagen"` (`BYTEA`) ni `"imagenBytes"` (`INTEGER`)** declaradas en `database/src/models/Producto.ts:191-210`. Como `GET /api/stock` (`stockController.ts:14`) y `GET /api/ventas/productos` (`operaciones.ts:191`) usan `attributes: { exclude: ['imagen'] }`, Sequelize intentaba seleccionar `"imagenBytes"` (y cualquier consulta sin `exclude` intentaba seleccionar `"imagen"`), provocando error SQL.
3. **Resolución dual-stack IPv6/IPv4 en Node 24 / Windows:** `frontend/vite.config.ts:9-14` apuntaba previamente a `http://localhost:3000`, que bajo Happy Eyeballs en Node `v24.20.0` intenta `::1:3000` y `127.0.0.1:3000` (generando `AggregateError [ECONNREFUSED]` cuando el puerto 3000 está caído), mientras que Vite sin `server.host` no escuchaba en `127.0.0.1:5173` y `backend/src/app.ts` (`HEAD:19`, ahora líneas `18-45`) restringía CORS únicamente a `'http://localhost:5173'` (dejando fuera a `http://127.0.0.1:5173`, usado por Playwright).

### 1.2 Conectividad real a Supabase
- Fuera del entorno aislado sin DNS (`ENOTFOUND` en sandbox), `database/.env` conecta correctamente al Session Pooler de Supabase (`aws-0-us-east-1.pooler.supabase.com:5432`, usuario `postgres.hrupbamnkiezrqzikjwd`).
- Se verificaron **las 24 tablas existentes** con datos reales iniciales preservados al **100 %** antes y después de ejecutar el arranque completo del backend (ver §4).

---

## 2. Hallazgos de Revisión de Código y Arquitectura

### Severidad Crítica / Alta

| # | Módulo / Archivo | Hallazgo | Estado |
|---|---|---|---|
| **C1** | `database/src/models/Producto.ts:191-210`<br>`database/src/migrations/productCatalog.ts` | `Producto.ts` declaraba `imagen`, `imagenNombre`, `imagenMime`, `imagenBytes`, pero `productCatalog.ts` no agregaba las columnas de imagen. En Supabase faltaban `imagen` e `imagenBytes`. | **Corregido** (migración idempotente `ADD COLUMN IF NOT EXISTS`) |
| **C2** | `database/src/migrations/comprasSprint4.ts:108-151`<br>`database/src/migrations/limpiezaEsquema.ts`<br>`database/src/migrations/zonaHorariaRecepcion.ts` | Las migraciones ejecutadas en cada arranque contenían sentencias capaces de mutar o eliminar datos existentes sin resguardo: `UPDATE compras SET "pedidoId" = NULL`, `DROP COLUMN "costoUnitario"` / `id`, `UPDATE pedidos SET estado = 'REALIZADO'`, `ALTER COLUMN TYPE` sin validar longitudes, y `UPDATE pedidos."fechaHoraRecepcion"` incondicional. | **Corregido** (resguardado con verificaciones `DO $$` no destructivas) |
| **C3** | `database/src/models/Compra.ts:18,121-129`<br>`database/src/relationships/relationships.ts`<br>`database/src/repositories/compraRepository.ts:104-108,154`<br>`database/src/repositories/recepcionRepository.ts:56,107` | `Compra.ts` tenía `recepcionId` como `allowNull: false` (contradiciendo `comprasSprint4.ts:160` nullable y `CompraRepository.crearAlternativa`). Además, el commit `a751473` había eliminado las asociaciones `Compra`/`Recepcion` de `relationships.ts`, pero `CompraRepository` y `RecepcionRepository` seguían haciendo `include: [{ model: Recepcion, as: 'recepcion' }]` e `include: [{ model: Compra, as: 'compra' }]`, lo que arrojaría `SequelizeEagerLoadingError` al invocarse. | **Corregido** (`recepcionId` nullable en modelo y asociaciones registradas sobre `recepcionId`) |
| **C4** | `database/package.json:7-41`<br>`backend/src/services/circuitoAbastecimiento.ts:2`<br>`backend/src/services/pedidos.ts:1,3,4` | Violación de frontera de paquete: `circuitoAbastecimiento.ts` y `pedidos.ts` importaban `../../../database/src/repositories/*.js` por ruta relativa, saltando el mapa `exports` de `polleria-database` (que además omitía `circuitoAbastecimientoRepository` y exportaba `pedidosRepository` en plural). | **Corregido** (exports completados e imports normalizados a `polleria-database/repositories/...`) |
| **C5** | Arquitectura de Seguridad (`backend/src/services/*`, `backend/src/app.ts:18-45`, `database/src/config/database.ts:30`) | (1) No existe autenticación ni autorización (RBAC); `usuarioId` está hardcodeado en `1` (`circuitoAbastecimiento.ts:33`, `operaciones.ts:44,70,100`, `inventario.ts:7`) o se acepta del cuerpo sin verificación. (2) `app.ts` (`HEAD:19`) hardcodeaba `origin: 'http://localhost:5173'`. (3) `database.ts:30` usa `rejectUnauthorized: false`. (4) `database/.env` almacena la contraseña de PostgreSQL en texto plano en disco (gitignored). | **CORS corregido** (`CustomOrigin` en `app.ts:18-45` con `DEFAULT_CORS_ORIGINS` + fallback para `CORS_ORIGIN=""`); resto documentado en §5 |

### Severidad Media

| # | Módulo / Archivo | Hallazgo | Estado |
|---|---|---|---|
| **M1** | `backend/src/services/pedidos.ts:160-183` (lote en `:174`) | **Consulta N+1 en `listarPedidos`:** ejecutaba `Promise.all(rows.map(p => new CircuitoRepository().relacionadas(p.id)))`, disparando 2 consultas SQL por cada fila de pedido. | **Corregido** (`relacionadasPorPedidos` en lote en 2 consultas totales) |
| **M2** | `backend/src/services/operaciones.ts:166` | **Consulta redundante:** dentro de `vender()`, tras cargar `ofertasPorId` en la línea 124, volvía a ejecutar `await Oferta.findByPk(l.ofertaId!, { transaction })` sólo para leer `.nombre`. | **Corregido** (`nombre = oferta.nombre`) |
| **M3** | `backend/src/controllers/proveedorController.ts:53-86`<br>`backend/src/controllers/productoController.ts:103-140` | **Mapeo inconsistente de errores de BD:** `proveedorController` usaba `/unique\|cuil\|email\|telefono/i` (falsos 409 ante errores que mencionen esas columnas, omitía `nombre` único y `SequelizeUniqueConstraintError` con mensaje `"Validation error"`). `productoController` tampoco inspeccionaba `error.name`/`fields`/`errors` ni mapeaba `SequelizeForeignKeyConstraintError` / `SequelizeValidationError` a 400. | **Corregido** (ambos inspeccionan `name`, `fields`, `errors` y texto, respetando mensajes esperados por las pruebas) |
| **M4** | `database/src/models/CuentaProveedor.ts:62` | `CuentaProveedor.ts` mapea `estado` con `field: 'ESTADO'` (mayúsculas). Se verificó en `information_schema.columns` que en Supabase la columna es efectivamente `"ESTADO"`. | **Verificado compatible** (sin cambios) |
| **M5** | `backend/src/controllers/productoController.ts:97-101,142-161`<br>`backend/src/services/ofertasGlobales.ts:29-35`<br>`backend/src/services/cuentas.ts:30,46` | Escaneos en memoria: `hasDuplicateName` y `validarNombreOfertaUnico` traen hasta `10000` filas a JS para comparar nombres; `getProductos` (`142-161`) trae todos los `ProductoProveedor` activos y filtra `O(N*M)` en JS; `cuentas.ts` llama `buscarTodas()`. | Documentado en §5 (fuera de cambio mínimo seguro) |
| **M6** | `backend/src/services/operaciones.ts:191`<br>`database/src/repositories/productoRepository.ts:295-296` | El parámetro de búsqueda `q` pasa a `Op.iLike` como `%${q}%` sin escapar metacaracteres `%` y `_` de SQL `ILIKE`. | Documentado en §5 |
| **M7** | `backend/tests/` + `@swc/core` en Windows/Node 24 | (1) En entornos con ACL restringida sobre `%LOCALAPPDATA%\swc` (p. ej. sandbox), `@swc/core` falla con `ERR_SWC_NATIVE_CACHE`; fuera del sandbox Jest ejecuta normalmente. (2) De las **28 suites Jest preexistentes** en `backend/tests/`, **19 pasan**, **8 fallan** por deriva previa (`recepcionController.test.ts`, `app.test.ts` [13 fallos preexistentes tras resolver el fallo de CORS en `1324-1326`], `proveedoresSprint3.test.ts`, `compraController.test.ts`, `operaciones.test.ts` [2 casos de `buscarProductos` por `stockActual > 0`], `adversarialTimestamp.test.ts`, `adversarialBug2.test.ts`, `imputacionCredito.test.ts`) y **1 aborta** por excepción no capturada en `pedidoController.test.ts:205` (deriva previa del commit `7cc2ef3` / `circuitoAbastecimientoRepository` sin mock ejecutando `sequelize.query` real con `usarTransaccionFalsa()`). Con la nueva suite `tests/api/cors.test.ts` (Iteración 2), son **20 suites pasando sobre 29 totales**. | **Regresión CORS (`app.test.ts:1324-1326`) corregida en Iteración 2**; suites heredadas documentadas sin alterar para preservar estado de sistema en vivo |

---

## 3. Cambios Aplicados

### `database/`
1. **`database/src/config/database.ts`**:
   - Prioriza `database/.env` sobre `<root>/.env` sin pisar variables ya definidas en `process.env` (preservando CI y `tests/setup.ts`).
   - Agrega configuración de pool (`max: 10, min: 0, acquire: 30000, idle: 10000`), `keepAlive: true`, `keepAliveInitialDelayMillis: 10000` y `connectionTimeoutMillis: 15000`.
2. **`database/src/migrations/productCatalog.ts`**:
   - Agrega migración idempotente `ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen BYTEA, ADD COLUMN IF NOT EXISTS "imagenNombre" VARCHAR(255), ADD COLUMN IF NOT EXISTS "imagenMime" VARCHAR(255), ADD COLUMN IF NOT EXISTS "imagenBytes" INTEGER`.
3. **`database/src/migrations/comprasSprint4.ts`**:
   - Resguarda el bloque de FK `compras_pedido_fk` para ejecutarse únicamente si no existe aún y sólo aplicarla cuando no haya `pedidoId` huérfanos (sin anular `pedidoId` existentes silenciosamente).
4. **`database/src/migrations/zonaHorariaRecepcion.ts`**:
   - Sólo sobreescribe `pedidos."fechaHoraRecepcion"` desde `recepciones."fechaHora"` cuando es `NULL` o cuando en la misma ejecución se acaba de convertir desde `timestamp without time zone`.
5. **`database/src/migrations/limpiezaEsquema.ts`**:
   - Resguarda los `DROP COLUMN` (`id`, `"costoUnitario"`), validación de PK compuesta sin duplicados, `UPDATE pedidos SET estado = 'REALIZADO'` (sólo si existe `'PENDIENTE'` y sin recepciones) y `ALTER COLUMN TYPE VARCHAR(...)` verificando primero `MAX(LENGTH(...))`.
6. **`database/src/models/Compra.ts`**:
   - Alinea `recepcionId` a `number | null` con `allowNull: true, defaultValue: null`.
7. **`database/src/relationships/relationships.ts`**:
   - Registra `Recepcion.hasOne(Compra, { foreignKey: 'recepcionId', as: 'compra' })` y `Compra.belongsTo(Recepcion, { foreignKey: 'recepcionId', as: 'recepcion' })`.
8. **`database/package.json`**:
   - Agrega `./repositories/circuitoAbastecimientoRepository` y `./repositories/pedidoRepository` a `exports`.
9. **`database/src/repositories/circuitoAbastecimientoRepository.ts`**:
   - Incorpora `relacionadasPorPedidos(pedidoIds, transaction?)` para resolver recepciones y compras asociadas en lote (2 queries por página en lugar de `2*N`).

### `backend/`
10. **`backend/.env`** (nuevo, gitignored): `PORT=3000` y `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173`.
11. **`backend/src/app.ts:18-45`**: Configura `DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']`, respaldo cuando `CORS_ORIGIN=""` queda vacío y callback `cors.CorsOptions['origin']` (`CustomOrigin`): cuando `requestOrigin === undefined` responde `allowedOrigins[0]` (`http://localhost:5173` por defecto, preservando `app.test.ts:1324-1326`), cuando `allowedOrigins.includes(requestOrigin)` permite ese origen exacto, y en caso contrario retorna `callback(null, false)` omitiendo `Access-Control-Allow-Origin` para orígenes no confiables.
12. **`backend/src/services/circuitoAbastecimiento.ts`** y **`backend/src/services/pedidos.ts`**:
    - Reemplazan imports relativos `../../../database/src/...` por `polleria-database/repositories/...`.
    - `listarPedidos` usa `relacionadasPorPedidos(pedidoIds)` en lote y maneja instancias Sequelize o planos de forma segura.
13. **`backend/src/services/operaciones.ts`**: Elimina la consulta redundante `Oferta.findByPk` en la línea 166 reutilizando `oferta.nombre`.
14. **`backend/src/controllers/proveedorController.ts:53-86`** y **`backend/src/controllers/productoController.ts:103-140`**:
    - Mapean `SequelizeUniqueConstraintError` (por `name`, `fields`, `errors` [`e.path`] y texto — paridad agregada en `proveedorController.ts:59-62` en Iteración 2), `SequelizeForeignKeyConstraintError` (400) y `SequelizeValidationError` (400).
15. **Pruebas unitarias (`backend/tests/`)**:
    - Se actualizaron los `jest.mock(...)` de rutas relativas a `polleria-database/repositories/...` en `app.test.ts`, `compraController.test.ts`, `pedidoController.test.ts`, `recepcionController.test.ts`, `circuitoAbastecimiento.test.ts` y `pedidoActual.test.ts`.
    - Se agregó `backend/tests/api/cors.test.ts` (Iteración 2, en memoria con rutas mockeadas) cubriendo los 5 casos CORS (sin `Origin`, `http://localhost:5173`, `http://127.0.0.1:5173`, `http://evil.example` y `CORS_ORIGIN=""`).
    - Se agregaron aserciones y casos de prueba en `circuitoRepositorio.test.ts` (`relacionadasPorPedidos`), `pedidoActual.test.ts` (`listarPedidos` en lote), `operaciones.test.ts` (1 sola consulta `Oferta.findByPk`), `proveedorController.test.ts` (incluyendo paridad `error.errors` en Iteración 2) y `productoController.test.ts` (mapeo de errores Sequelize).

### `frontend/`
16. **`frontend/vite.config.ts:6-15`**:
    - Configura `server.host: true` (`port: 5173`, exponiendo tanto `http://localhost:5173` como `http://127.0.0.1:5173`) y `proxy['/api'].target = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000'`.

---

## 4. Verificación de Preservación de Datos y Pruebas

### 4.1 Conteo de filas en Supabase (Pre-cambio vs Post-arranque)

| Tabla | Conteo Pre-cambio | Conteo Post-arranque | Estado |
|---|---:|---:|---|
| `pedidos_compra` | 2 | 2 | Preservada |
| `detalles_pedido_compra` | 4 | 4 | Preservada |
| `detalles_compra` | 2 | 2 | Preservada |
| `tipos_producto` | 3 | 3 | Preservada |
| `dias_pedido` | 7 | 7 | Preservada |
| `proveedores` | 4 | 4 | Preservada |
| `productos` | 46 | 46 | Preservada (`+imagen`, `+imagenBytes`) |
| `productos_dia_pedido` | 55 | 55 | Preservada |
| `productos_proveedores` | 44 | 44 | Preservada |
| `precios` | 50 | 50 | Preservada |
| `ofertas` | 4 | 4 | Preservada |
| `ofertas_productos` | 3 | 3 | Preservada |
| `ventas` | 20 | 20 | Preservada |
| `detallesVenta` | 33 | 33 | Preservada |
| `pedidos` | 4 | 4 | Preservada |
| `detallesPedido` | 44 | 44 | Preservada |
| `recepciones` | 4 | 4 | Preservada |
| `detalles_recepcion` | 44 | 44 | Preservada |
| `compras` | 4 | 4 | Preservada |
| `detallesCompra` | 44 | 44 | Preservada |
| `cuentas_proveedores` | 1 | 1 | Preservada |
| `pagos` | 1 | 1 | Preservada |
| `pagos_por_cuenta` | 1 | 1 | Preservada |
| `movimientos_stock` | 77 | 77 | Preservada |

### 4.2 Resultados de Verificación Técnica
> **Nota operativa de sistema en vivo (Iteración 2):** Hay **usuarios activos utilizando actualmente la base de datos Supabase en vivo**. Por ese motivo, toda la verificación de Iteración 2 se ejecutó estrictamente **en memoria / solo lectura**, sin ejecutar scripts ni pruebas que escriban, modifiquen o eliminen filas en Supabase.

- **`database/`**: `npx tsc --noEmit` -> Exit 0 (Iteración 2); en Iteración 1 `npm run test:connection` -> `✅ Conexión exitosa con Supabase` (Exit 0, solo lectura).
- **`backend/` (Iteración 2, estrictamente en memoria)**:
  - `npm run typecheck` -> Exit 0; `npm run typecheck:tests` -> Exit 0; `npm test` (`tsx --test`) -> **6/6 PASS**.
  - `npx jest --runInBand tests/api/cors.test.ts` -> **5/5 PASS** (sin `Origin`, `localhost:5173`, `127.0.0.1:5173`, `evil.example` y `CORS_ORIGIN=""`).
  - `npx jest --runInBand tests/api/app.test.ts -t "comportamiento transversal de la API"` -> **8/8 PASS** (incluyendo `app.test.ts:1324-1326`, regresión CORS resuelta en Iteración 2).
  - 9 suites Jest objetivo (`circuitoAbastecimiento`, `circuitoRepositorio`, `pedidoActual`, `productoController`, `proveedorController`, `operacionesController`, `stockController`, `precioController`, `controllerHelpers`) -> **9/9 PASS**.
  - Estado completo de las **28 suites Jest preexistentes** en `backend/tests/` (+ `cors.test.ts` = **29 suites totales**): **20 suites pasan** (`19` preexistentes + `cors.test.ts`), **8 suites preexistentes fallan** (`recepcionController.test.ts`, `app.test.ts` [13 fallos preexistentes tras resolver `1324-1326`: 3 en `/api/productos`, 4 en `/api/compras`, 6 en `/api/pedidos` y `/api/recepciones`], `proveedoresSprint3.test.ts`, `compraController.test.ts`, `operaciones.test.ts` [2 fallos preexistentes en `buscarProductos` por `stockActual > 0`], `adversarialTimestamp.test.ts`, `adversarialBug2.test.ts`, `imputacionCredito.test.ts`) y **1 suite preexistente aborta** con `TypeError: Cannot read properties of undefined (reading 'query')` en `pedidoController.test.ts:205` (ocasionado por deriva previa del commit `7cc2ef3` / `circuitoAbastecimientoRepository` sin mock invocando `sequelize.query` real con `usarTransaccionFalsa()`).
- **`frontend/`**: `npm run lint` (`oxlint`, 71 archivos) -> 0 warnings, 0 errors; `npm run build` -> Exit 0; `npm test` (`vitest`) -> 11 archivos, 127/127 tests PASS.
- **Endpoints en vivo & Proxy Vite (verificados en Iteración 1; comandos de arranque R3)**:
  - Directo `http://127.0.0.1:3000`: `/api/health` (200), `/api/stock?page=1&limite=5` (200, `X-Total-Count: 46`), `/api/ventas?limite=5` (200), `/api/productos` (200), `/api/pedidos` (200), `/api/proveedores` (200), `/api/compras` (200), `/api/recepciones` (200).
  - Proxy Vite `http://localhost:5173/api/...` y `http://127.0.0.1:5173/api/...`: todos los endpoints anteriores devolvieron **HTTP 200** sin `ECONNREFUSED`.
  - Arranque de servidores de desarrollo para R3 (detenidos tras verificación para liberar puertos y proteger pruebas de usuarios):
    - Backend: `cd backend && npm run dev` (puerto `3000`)
    - Frontend: `cd frontend && npm run dev` (puerto `5173`)

---

## 5. Recomendaciones Pendientes (Fuera de remediación mínima)

1. **Autenticación y RBAC:** Implementar sesión/JWT real en `/api/*` y reemplazar los `usuarioId = 1` hardcodeados (`circuitoAbastecimiento.ts:33`, `operaciones.ts:44,70,100`, `inventario.ts:7`) por el usuario autenticado en `req.user`.
2. **Validación TLS estricta (`database/src/config/database.ts:30`):** Configurar el certificado CA de Supabase (`sslrootcert`) para poder activar `rejectUnauthorized: true` en producción y eliminar la omisión de verificación TLS.
3. **Actualización de las 9 suites Jest preexistentes desfasadas y `@swc/core`:** Alinear en un PR dedicado (sin tocar datos en vivo) las 8 suites que fallan (`recepcionController.test.ts`, `app.test.ts` [13 casos preexistentes], `proveedoresSprint3.test.ts`, `compraController.test.ts`, `operaciones.test.ts` [`buscarProductos`], `adversarialTimestamp.test.ts`, `adversarialBug2.test.ts`, `imputacionCredito.test.ts`) y el crash en `pedidoController.test.ts:205` (mockeando `circuitoAbastecimientoRepository` / mapeando `../config/database.js` en `jest.config.cjs`) frente a los contratos vigentes de Sprint 4 (`7cc2ef3`); documentar o configurar `SWC_NATIVE_BINDING_CACHE` en entornos Windows restringidos.
4. **Migraciones versionadas:** Reemplazar la ejecución de las 9 migraciones en cada arranque (`backend/src/server.ts:19-27`) por una tabla de control de migraciones (`sequelize_meta`) o CLI dedicado para evitar locks DDL innecesarios en producción.
5. **Escaneos en memoria y `ILIKE`:** Reemplazar `findAll(..., 10000)` en `hasDuplicateName` (`productoController.ts:97`) y `validarNombreOfertaUnico` (`ofertasGlobales.ts:29`) por consultas SQL filtradas, y escapar `%`/`_` en búsquedas `Op.iLike` (`operaciones.ts:191`, `productoRepository.ts:295`).
6. **Higiene del repositorio:** Archivar o retirar las 3 tablas heredadas sin modelo (`pedidos_compra`, `detalles_pedido_compra`, `detalles_compra`) una vez validado que no se requieran para auditoría histórica; remover dependencias sin uso (`axios` en `frontend/package.json`, `@supabase/ssr` y `@supabase/supabase-js` en `database/package.json`), eliminar el `package-lock.json` vacío de la raíz y actualizar `backend/README.md:258` respecto al endpoint `410 Gone` de comprobantes.
