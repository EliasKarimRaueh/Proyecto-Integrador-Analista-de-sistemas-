# 🍗 Sistema de Gestión para Pollería

Sistema desarrollado para la administración integral de pedidos, stock, clientes y autenticación de usuarios de la pollería.

## 🏛️ Arquitectura del Proyecto

El proyecto sigue una arquitectura de **monolito bien estructurado**, separando claramente las responsabilidades en tres capas principales dentro del mismo repositorio:
- **Frontend (`/frontend`):** Interfaz de usuario interactiva y tipada.
- **Backend (`/backend`):** API REST encargada de la lógica de negocio y los servicios.
- **Database (`/database`):** Esquemas y scripts de persistencia de datos.

## 🚀 Stack Tecnológico

- **Frontend:** 
  - [React](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
- **Backend:** 
  - [Node.js](https://nodejs.org/) con [Express](https://expressjs.com/)
  - [TypeScript](https://www.typescriptlang.org/)
  - **Autenticación:** JSON Web Tokens (JWT)
- **Base de Datos:** 
  - [PostgreSQL](https://www.postgresql.org/)
- **Calidad y Testing:** 
  - [Jest](https://jestjs.io/) / [Vitest](https://vitest.dev/)
- **Documentación:** 
  - [Swagger / OpenAPI](https://swagger.io/)
- **Control de Versiones:** 
  - [GitHub](https://github.com/)

## 📁 Estructura del Repositorio

- `frontend/`: Código fuente de la interfaz de usuario.
- `backend/`: API REST, controladores, rutas y lógica de negocio.
- `database/`: Scripts SQL de creación de tablas y migraciones.

## 🛠️ Buenas Prácticas de Desarrollo

Para mantener la calidad y escalabilidad del proyecto, el equipo de desarrollo adopta los siguientes estándares:

### ✍️ Escritura de Código
- **Prioriza la legibilidad:** Escribe código claro para que otros desarrolladores puedan entenderlo sin esfuerzo.
- **Funciones pequeñas:** Haz que cada función cumpla una sola tarea específica.
- **Nombres claros:** Usa nombres de variables y funciones que expliquen por sí mismos su propósito (código autodescriptivo).
- **Evita repetir código (Principio DRY):** Reutiliza funciones y módulos en lugar de copiar y pegar fragmentos idénticos.

### 🛡️ Mantenimiento y Control
- **Control de versiones:** Usa Git y GitHub para registrar cada cambio en el código, respetando la estructura de ramas.
- **Testing:** Comprueba de forma automática que el software funciona bien tras cada cambio importante.
- **Refactorización:** Mejora la estructura interna del código periódicamente sin cambiar su comportamiento externo.

---

## ⚙️ Guía de Configuración e Instalación

### Prerrequisitos
- Node.js instalado en tu computadora.
- PostgreSQL instalado y configurado localmente o en un servidor remoto.

### 1. Clonar el repositorio
```bash
git clone <url-de-tu-repositorio>
cd <nombre-del-proyecto>
```

### 2. Iniciar el frontend
```bash
cd frontend
npm install
npm run dev
```

La interfaz se sirve en `http://localhost:5173`. Requiere Node.js 22.12+ o 24 LTS.
Consultá [la documentación del frontend](frontend/README.md) para conocer la estructura, los comandos y la conexión con el backend.

### 3. Iniciar el backend
En otra terminal, desde la raíz del repositorio:
```bash
cd backend
npm install
npm run dev
```

El backend utiliza el puerto `3000` por defecto. Las pantallas del frontend son una base inicial; las operaciones de pedidos, stock, clientes y autenticación todavía deben implementarse.
