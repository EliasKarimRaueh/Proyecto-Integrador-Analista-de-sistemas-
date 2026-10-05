# Frontend de AvixSoft — Sprint 2

React, TypeScript y Vite, integrado con la API de Express y PostgreSQL/Supabase. Catálogo, precios, ofertas, ventas y existencias usan datos del servidor; no hay un catálogo de demostración en `localStorage`.

## Ejecutar

Requiere Node.js 24 LTS. Primero instalar dependencias de `database` y `backend`, guardar la conexión en `database/.env` e iniciar el backend:

```sh
cd backend
npm ci
npm run dev
```

En otra terminal:

```sh
cd frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173`. En PowerShell con scripts deshabilitados, usar `npm.cmd`. Vite redirige `/api` hacia `http://localhost:3000/api`, conservando el prefijo. No hace falta un `.env` en frontend. `.env.example` permite personalizar `VITE_API_URL`; estas variables son públicas y nunca deben contener la conexión a la base ni secretos.

En producción, configurar un proxy `/api` hacia el backend o definir `VITE_API_URL` con el prefijo `/api` antes de compilar y habilitar el origen correspondiente en CORS. El alojamiento debe redirigir las rutas del frontend a `index.html` para que React Router funcione al recargar.

## Pantallas

| Ruta | Funcionalidad |
| --- | --- |
| `/` | Inicio con ventas del día, alertas de reposición y accesos operativos |
| `/caja` | Búsqueda por código/nombre, kilos/unidades, listas minorista/mayorista, ofertas, cotización, confirmación y comprobante |
| `/productos` | Alta, edición, baja lógica, filtros, precios vigentes e historial de precios |
| `/ofertas` | Alta, edición, vigencia, cantidades por componente, precios y baja lógica |
| `/stock` | Existencias, estados Normal/Próximo al Mínimo/Crítico, límites de reposición y movimientos justificados |
| `/desposte` | Origen, múltiples derivados, balance de kilos, merma y confirmación de la operación |
| `/ventas` | Historial paginado, fechas, comprobantes y egresos vinculados |
| `/movimientos` | Historial paginado con producto, fechas, tipo, venta y operación de desposte |

Pedidos, clientes y autenticación conservan sus rutas iniciales, fuera de los módulos operativos de este Sprint. No se presentan como funcionalidades terminadas en el menú principal.

## Operaciones

En caja, seleccionar un producto o una oferta y editar su cantidad. Se aceptan coma o punto para kilos; las unidades y combos requieren enteros. Cambiar de lista vuelve a cotizar todo el carrito. La cotización del backend determina precios, subtotales y total; una cantidad inválida o un error impide confirmar. Enter sobre un código exacto agrega el producto. La confirmación bloquea los controles y muestra un comprobante sólo cuando la API devuelve la venta registrada.

Un rechazo de la API conserva el carrito. Si se pierde la respuesta de una venta, la UI pide revisar el historial antes de habilitar otro intento, porque el backend no tiene claves de idempotencia. El carrito es un borrador en memoria: no reserva stock ni permanece al recargar la página. Las ventas confirmadas sí quedan guardadas.

Desde inventario, `Registrar movimiento` permite entradas, salidas, ajustes absolutos o relativos, mermas, pérdidas, vencimientos y roturas. El motivo es obligatorio. En un ajuste absoluto se ingresa el stock total contado, inclusive cero. El botón de configuración permite establecer el mínimo de reposición. Las cantidades se expresan en la unidad de stock/venta, sin conversión automática de cajones o cajas.

El fraccionamiento admite productos activos en kilos, exige derivados distintos del origen y valida que derivados más merma coincidan con los kilos de origen. El backend guarda todo en una transacción. El resultado enlaza los movimientos mediante su `operacionId`.

Las ofertas permiten definir la cantidad de cada producto por combo. El precio de cada componente es el total para esa cantidad, no un precio a multiplicar nuevamente al vender. Por ejemplo, un componente de 2 kg a $8000 descuenta 2 kg y cobra $8000 por combo.

Los historiales muestran horas de Argentina. Los filtros de fecha incluyen el día entero en UTC−03:00. Las consultas permiten navegar páginas y abrir ventas/movimientos sin mezclar los resultados de filtros anteriores. El inventario recorre todas las páginas del endpoint para no truncar sus alertas a 1000 productos.

## Verificación

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

Vitest y Testing Library prueban catálogo, precios, ofertas, caja, inventario, fraccionamiento, auditoría y validaciones con API simulada. Playwright comprueba los flujos en Chromium y el ancho móvil. Las capturas se guardan en `artifacts/` y los fallos en `test-results/`, ambos ignorados por Git. El workflow `.github/workflows/frontend.yml` ejecuta compilación, análisis y ambas suites en pull requests y pushes a `main`/`master`.

La prueba de lectura contra la API real se activa por separado, con el backend iniciado y productos con precio y stock disponibles:

```powershell
$env:E2E_LIVE = 'true'
npm.cmd run test:e2e -- live.spec.ts
Remove-Item Env:E2E_LIVE
```

Esta prueba consulta las pantallas y cotiza un carrito; no confirma ventas ni modifica mercadería. Las pruebas de escritura reales están en `backend/test/integration.test.ts` y revierten sus fixtures.
