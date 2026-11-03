# Sprint 4 — Bloque 2: caja, despacho y promociones

## Uso

- En **Caja**, buscar por nombre y filtrar por categoría desde un desplegable sin escritura. El selector siempre conserva todas las categorías y la opción «Todas las categorías» para cambiar o quitar el filtro. La grilla permite ordenar A–Z, Z–A y por más vendido. El filtro y el orden se aplican en el servidor antes de paginar.
- Al crear o editar ofertas se ingresa directamente el **precio final por combo**, sin un campo de porcentaje. Las tarjetas muestran sus productos, cantidades y el precio final pactado, que se mantiene al cambiar entre lista minorista y mayorista. También se pueden incluir productos sin precio de lista. Las ofertas porcentuales anteriores conservan su cálculo hasta editarlas y guardar un precio final explícito.
- Al agregar una promoción, indicar cantidad de combos y peso real total de cada componente vendido por kilos. Cambiar la cantidad de combos borra los pesajes para exigir una nueva lectura. Las unidades se calculan a partir de los componentes del combo y no se pueden sustituir por otra cantidad.
- No se puede confirmar la venta hasta completar los pesajes. El precio se calcula con las cantidades promocionales; el stock se valida y descuenta con las cantidades reales. El precio, cantidad promocional y despacho real quedan visibles en el comprobante y el historial.
- Para crear o editar una oferta sin finalización, dejar **Vigente hasta** vacío. El último día de vigencias cerradas se incluye completo en el horario argentino.
- En **Ofertas**, las dadas de baja pueden consultarse con el filtro correspondiente y reactivarse eligiendo una vigencia nueva. Se comprueban productos, precios vigentes cuando corresponda, vencimiento y superposición con promociones activas que compartan productos.

## Garantías y persistencia

- `Oferta.fechaFin` admite `NULL`. Las consultas de vigencia y el punto de venta contemplan las vigencias abiertas.
- `DetalleVenta.despacho` almacena un snapshot JSONB con producto, nombre, unidad, cantidad promocional y cantidad realmente despachada. La edición o baja posterior de una oferta no altera ese historial.
- La confirmación de una venta con promociones por peso exige un despacho explícito. La cotización puede usar las cantidades nominales mientras se carga el pesaje; la interfaz bloquea el cobro hasta completarlo.
- El despacho debe incluir todos los componentes activos, sin duplicados ni productos ajenos, con cantidades positivas y hasta tres decimales. Los componentes vendidos por unidad deben coincidir con las unidades pactadas.
- Venta, detalles y movimientos se guardan en una transacción. La validación del margen de stock utiliza el consumo real acumulado.
- Crear, editar o reactivar ofertas valida superposiciones dentro de una transacción con un bloqueo asesor de PostgreSQL compartido. Dos reactivaciones incompatibles simultáneas producen una aprobación y un conflicto, sin dejar ambas ofertas activas.
- «Más vendido» cuenta ventas distintas, incluyendo líneas directas y componentes registrados en los despachos de promociones. Las ventas anteriores mantienen sus datos originales; no se inventan pesajes históricos.

## Códigos de producto

Se quitaron de formularios de edición, selectores, detalles de ofertas y reposición, así como de los textos visibles de búsqueda. También se quitaron los identificadores numéricos usados como texto alternativo de productos. Los códigos e IDs siguen disponibles internamente para conservar asociaciones, edición y búsqueda con lectores sin mostrarlos en la interfaz. Al guardar un producto editado se conserva su código anterior.

## API

- `GET /api/ventas/categorias`: categorías activas para sugerencias.
- `GET /api/ventas/productos?categoria=fresco&orden=mas_vendido`: filtro parcial de categoría y orden `nombre_asc`, `nombre_desc` o `mas_vendido`, combinables con búsqueda y paginación.
- `GET /api/ofertas?incluirBajas=true`: incluye ofertas inactivas.
- `POST/PUT /api/ofertas`: `fechaFin: null` representa una vigencia abierta; `precioFinal: "2500.25"` fija el importe del combo. Se guarda como decimal y al editar reemplaza el cálculo porcentual anterior.
- `PUT /api/ofertas/:id/reactivar`: recibe `fechaInicio` y `fechaFin` opcional/nula; los conflictos devuelven 409.
- `POST /api/ventas/cotizacion` y `POST /api/ventas` reciben el despacho total de cada línea de oferta:

```json
{
  "detalles": [{
    "ofertaId": 10,
    "cantidad": 2,
    "despacho": [{ "productoId": 1, "cantidadReal": 6.235 }]
  }]
}
```

En este ejemplo se cobran dos combos con sus cantidades pactadas y se descuentan 6,235 kg. El servidor obtiene los productos y precios de la oferta; no acepta precios indicados por el cliente.

## Migraciones y verificación

El inicio habitual del backend aplica la migración idempotente del Sprint 4: permite `fechaFin` nula y agrega `despacho` a `detallesVenta` sin borrar registros. Para validar localmente:

```powershell
# backend
npm.cmd run typecheck
npm.cmd run typecheck:tests
npm.cmd run test:jest -- --runInBand

# frontend
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd exec playwright test

# database
npm.cmd run build
```

La integración real se ejecuta con `DATABASE_URL` apuntando a PostgreSQL local en una base dedicada terminada en `_test`, `DATABASE_SSL=false` y `TEST_SPRINT4_DATABASE=true`:

```powershell
npm.cmd run test:integration:bloque2
```

Prueba precios fijos y porcentuales, diferencias entre cantidad cobrada y despachada, validaciones, historial inmutable, ranking, filtros, vigencias abiertas y reactivaciones concurrentes. Las pruebas de navegador simulan la API; la prueba opcional contra Supabase requiere `E2E_LIVE=true` y no forma parte de la validación local.

Verificación al cerrar el bloque: 608 pruebas Jest, 107 pruebas Vitest y 13 pruebas Playwright aprobadas (una prueba de Supabase omitida). También pasaron las integraciones sobre PostgreSQL aislado del bloque 2, compras del bloque 1 y la regresión de ventas/desposte: 26 comprobaciones en total. Compilación, chequeo de tipos y lint completados sin errores.
