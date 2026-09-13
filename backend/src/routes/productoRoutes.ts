// backend/src/routes/productoRoutes.ts
import { Router } from 'express';
import { getProductos } from '../controllers/productoController.js';

const router = Router();

// Cuando hagan un GET a la ruta base de productos, ejecuta la función getProductos
router.get('/', getProductos);

export default router;