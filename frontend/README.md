# Frontend de la pollería

Base de React + TypeScript con Vite, React Router y Oxlint. TypeScript está configurado en modo estricto.

## Ejecutar

Requiere Node.js 22.12+ o 24 LTS y npm.

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173. En PowerShell, si la política de ejecución bloquea `npm`, usá `npm.cmd`.

## Estructura

```text
frontend/
├── public/                   # Archivos estáticos servidos sin transformar
├── src/
│   ├── app/
│   │   └── App.tsx           # Configuración de rutas
│   ├── features/             # Módulos del negocio
│   │   ├── auth/             # Acceso de usuarios
│   │   ├── customers/        # Clientes
│   │   ├── home/             # Inicio
│   │   ├── orders/           # Pedidos
│   │   └── stock/            # Productos y existencias
│   ├── shared/
│   │   ├── components/       # Layout y componentes reutilizables
│   │   ├── services/api.ts   # Cliente HTTP común
│   │   └── styles/           # Estilos globales
│   ├── main.tsx              # Entrada de React
│   └── vite-env.d.ts         # Tipos de variables de entorno
├── .env.example
├── index.html
├── vite.config.ts
└── tsconfig*.json
```

Dentro de cada módulo, agregá `components/`, `hooks/`, `services/` y `types/` cuando exista código que los necesite. El código usado por varios módulos va en `shared/`. Mantené las llamadas HTTP fuera de los componentes de presentación.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Inicio |
| `/productos` | Catálogo de productos |
| `/pedidos` | Pedidos |
| `/stock` | Stock |
| `/clientes` | Clientes |
| `/login` | Acceso |

Las pantallas de los módulos son iniciales: todavía no realizan operaciones ni autentican usuarios. La navegación incluye una pantalla para rutas inexistentes.

## Backend y variables de entorno

La configuración funciona sin crear un `.env`. Podés copiar `.env.example` a `.env` para personalizar `VITE_API_URL`. Reiniciá Vite después de modificarlo. Las variables `VITE_*` son públicas: no guardes secretos en ellas.

En desarrollo, las solicitudes a `/api` se redirigen a `http://localhost:3000`, eliminando el prefijo. Por ejemplo, `/api/` llega a `/`, la ruta inicial del backend existente. Si cambiás el puerto del backend, actualizá el destino en `vite.config.ts`.

El cliente compartido se utiliza con endpoints que devuelven JSON:

```ts
import { apiRequest } from '../../shared/services/api'

const result = await apiRequest<{ message: string }>('/')
```

`apiRequest` admite las opciones de `fetch`, incluyendo `signal` y encabezados. El tipo genérico describe la respuesta esperada; no valida datos en tiempo de ejecución. Los endpoints de negocio y la integración JWT quedan pendientes de definir junto con el backend.

En producción, configurá un proxy `/api` hacia el backend o definí `VITE_API_URL` antes de compilar y configurá CORS en el servidor si usás otro origen. El proxy de Vite solo se aplica durante desarrollo. El alojamiento debe redirigir las rutas de la interfaz a `index.html` para permitir recargas con React Router.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verifica TypeScript y genera `dist/` |
| `npm run lint` | Analiza el código con Oxlint |
| `npm run preview` | Previsualiza la compilación localmente |
| `npm test` | Pruebas de productos con Vitest y Testing Library |

La base todavía no incluye pruebas automatizadas. Al implementar comportamiento de negocio, incorporá Vitest según lo indicado en el README del repositorio.

## Productos · Sprint 1

La ruta `/productos` implementa consulta, búsqueda por nombre o código, filtros por categoría y estado, ficha de detalle, registro, edición y baja lógica con confirmación. Los códigos son únicos sin distinguir mayúsculas; los productos inactivos conservan su código. Nombre, código, categoría y unidad de venta son obligatorios.

La interfaz usa el estilo de La Nena, con navegación lateral, acentos amarillos y adaptación a pantallas pequeñas. La baja conserva el registro como inactivo. Precios, ofertas, movimientos de stock y permisos de usuario quedan fuera de esta entrega.

Por ahora el catálogo utiliza `localStorage` (`la-nena.products.v1`) y carga ocho productos de ejemplo cuando no hay datos guardados. No es una integración con PostgreSQL ni con la API; los cambios pertenecen al navegador y origen actuales y no se comparten entre equipos. La UI identifica este entorno como demostración. Los errores de lectura o escritura se muestran sin anunciar cambios como guardados.

- `src/features/products/ProductsPage.tsx`: pantalla, formularios y filtros.
- `src/features/products/products.ts`: modelo, validación y persistencia local.
- `src/shared/components/Modal.tsx`: diálogo nativo, cierre con Escape y restitución del foco.
- `tests/products.test.tsx`: pruebas de los flujos y de errores de almacenamiento.

Ejecutá `npm test` para correr las pruebas con Vitest y Testing Library.

