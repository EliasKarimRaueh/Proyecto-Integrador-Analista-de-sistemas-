# Sprint 3: revisión y división del trabajo

## Estado encontrado

- React, TypeScript y Vite, con catálogo, precios, ofertas, caja, ventas e inventario conectados a Express.
- Componentes compartidos para formularios, diálogos, tablas, errores y carga; suites Vitest y Playwright.
- API de proveedores con alta, consulta, modificación, baja lógica y reactivación. Sin pantalla ni servicio HTTP en frontend.
- Reactivación de productos disponible en backend, sin acción en frontend. El código interno se mostraba en tabla y detalle.
- Modelos y repositorios de productos por proveedor, compras, cuentas, pagos y aplicaciones de pagos. No hay endpoints para asociaciones, estados de cuenta ni pagos.
- Proveedor utiliza `nombre` y `cuil`; la interfaz los identifica como razón social y CUIT. No tenía dirección ni días de entrega. `DiaPedido` está asociado a productos y no representa entregas por proveedor.
- Las ofertas guardan precios por componente y la cotización suma esos precios. No existe descuento global en el modelo de oferta.
- El arranque ejecutaba migraciones de catálogo y precios/ofertas, sin una migración específica de proveedores.
- Se detectó una consulta de pagos pendientes en `proveedorRepository` que usa `pagoPendiente`, mientras el modelo define `importePendiente`. Corregir al integrar finanzas.

## Parte 1: directorio de proveedores y catálogo

- Ruta `/proveedores` y acceso en el menú.
- Alta, detalle, modificación, baja lógica y reactivación, con confirmación de cambios de estado.
- Búsqueda inmediata por razón social, CUIT, teléfono, email y dirección; filtros combinables por actividad y cuenta corriente.
- Campos de contacto, dirección, días de entrega, descripción y habilitación de cuenta corriente. El indicador de habilitación no representa un saldo.
- Validación de formatos, longitudes y duplicados; errores de servidor conservan el formulario; bloqueo durante escrituras.
- Modelo y API ampliados con `direccion` y `diasEntrega`. Migración incremental ejecutada al iniciar backend, siguiendo el mecanismo existente. Reiniciar backend antes de usar la nueva pantalla.
- Código interno oculto en tabla y detalle de productos; se conserva al crear/editar y en búsqueda para mantener compatibilidad operativa.
- Reactivación de productos a través de `PUT /api/productos/:id/reactivar`.
- Pruebas de interfaz y validación, pruebas de controlador y recorrido Playwright con API simulada.

## Parte 2: asociaciones, ofertas y finanzas (implementada)

1. Exponer consulta y modificación de productos asociados a cada proveedor, conservando bajas e historial; integrar selector y búsqueda en frontend.
2. Reestructurar gestión y aplicación de ofertas: precios de lista por cantidades, subtotal conjunto y descuento sobre ese subtotal. Mantener coherencia entre formulario, detalle, cotización y venta, incluyendo compatibilidad con ofertas existentes y pruebas de redondeo.
3. Exponer saldos y movimientos históricos de cada proveedor, con filtros y paginación.
4. Exponer registro transaccional de pagos totales/parciales y validar importe positivo, deuda disponible, concurrencia y aplicación a cuentas. Integrar formulario, confirmación y actualización de saldos en frontend.
5. Revisar migraciones de cuentas/compras/pagos y comprobantes contra PostgreSQL; completar pruebas de integración y recorridos de interfaz.

La segunda parte se implementó luego del OK del usuario. Al revisar la versión actual del repositorio también estaban disponibles servicios genéricos de catálogo, compras, cuentas y pagos. Se conservaron sus rutas y se agregaron operaciones por proveedor para selección atómica de productos, consulta conjunta del historial y registros con idempotencia y control transaccional de deuda.

### Ajustes solicitados al continuar

- El alta de productos no pide código. Se conserva `codigo` en PostgreSQL y el backend genera un identificador interno de hasta 20 caracteres, sin depender del nombre del producto.
- Caja no muestra código ni stock en las tarjetas de producto; las acciones de agregar producto/oferta quedan junto al contenido con menor altura y separación.
- Las nuevas ofertas guardan `descuentoPorcentaje`. Los precios de lista vigentes y las cantidades determinan el subtotal; el descuento se aplica una sola vez a esa suma. Las ofertas previas mantienen su precio hasta una edición explícita.
- Cuenta corriente permite registrar comprobantes de deuda sin alterar stock, pagos parciales/totales, consulta del recibo y filtros con paginación. No permite sobrepago; las aplicaciones cancelan primero las compras más antiguas. La baja de un proveedor conserva historial y permite cancelar deudas existentes.
- Pagos y comprobantes usan `claveOperacion` para que un reintento devuelva el registro existente. Cada pago bloquea el proveedor y las cuentas y confirma registro, aplicaciones y saldo en una transacción.
- `migrateCuentasProveedores` crea tablas faltantes y agrega columnas/índices sin recrear tablas. Se ejecuta junto con las demás migraciones al iniciar backend.

### Contrato usado por el frontend

| Método y ruta | Función |
| --- | --- |
| `GET /api/proveedores/:id/productos` | Relaciones históricas y activas |
| `PUT /api/proveedores/:id/productos` | Selección completa mediante `productoIds` |
| `GET /api/proveedores/:id/cuenta` | Saldo total, crédito y páginas de comprobantes/pagos; filtros `page`, `limite`, `estado`, `desde`, `hasta` |
| `POST /api/proveedores/:id/comprobantes` | Número, fecha, total y clave de operación |
| `POST /api/proveedores/:id/pagos` | Importe, clave de operación y aplicaciones de pago |
| `POST /api/ofertas`, `PUT /api/ofertas/:id` | Cantidades y descuento global; compatibilidad con contratos anteriores |

La migración y los flujos se verifican contra PostgreSQL con `npm run test:integration:sprint3` en backend. La prueba ejecuta DDL y datos de prueba dentro de una transacción exterior que siempre revierte. No deja compras, pagos, ventas ni cambios de stock de prueba.

## Verificación de la primera parte

- Frontend: compilación y análisis estático correctos; 92 pruebas Vitest aprobadas.
- Playwright: recorrido de proveedores aprobado en escritorio y móvil, con API simulada; capturas en `frontend/artifacts/proveedores-desktop.png` y `frontend/artifacts/proveedores-mobile.png`.
- Backend: comprobación de tipos de código y tests correcta; 6 pruebas de operaciones y 510 pruebas Jest aprobadas.
- Se corrigió una prueba preexistente de precios cuya fecha de entrada usaba UTC y la expectativa usaba el calendario local.
- No se ejecutaron migraciones ni pruebas de escritura contra PostgreSQL remoto. La migración de proveedores está conectada al arranque del backend y deberá aplicarse al reiniciarlo.

## Verificación al terminar la segunda parte

- Frontend: compilación y análisis estático correctos; 99 pruebas Vitest aprobadas.
- Backend: tipos de código y tests correctos; 6 pruebas de operaciones y 544 pruebas Jest aprobadas.
- Navegador: 7 recorridos Playwright aprobados, incluyendo escritorio/móvil, asociaciones, comprobantes, pagos, ofertas y altura de tarjetas de caja. El recorrido opcional `E2E_LIVE` permanece desactivado; la integración real se ejecutó por separado desde backend.
- PostgreSQL: 5 pruebas de integración aprobadas (prueba principal y cuatro subpruebas). Verifican migración idempotente, asociaciones, HTTP, pagos parciales/totales, reintentos, sobrepago, reversión de una escritura fallida y venta/cotización de ofertas con la lista mayorista.
- Todos los datos y el DDL de esa integración se revierten. Las migraciones de uso normal se aplican al reiniciar backend.
