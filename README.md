# 🍗 Sistema de Gestión para Pollería

Sistema desarrollado para la administración integral de pedidos, stock, clientes y autenticación de usuarios de la polulería.

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

## ⚙️ Guía de Configuración e Instalación

### Prerrequisitos
- Node.js instalado en tu computadora.
- PostgreSQL instalado y configurado localmente o en un servidor remoto.

### 1. Clonar el repositorio
```bash
git clone <url-de-tu-repositorio>
cd <nombre-del-proyecto>