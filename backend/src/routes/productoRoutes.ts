// backend/src/routes/productoRoutes.ts
import { Router } from 'express';
import { createProducto, deactivateProducto, getProductos, updateProducto } from '../controllers/productoController.js';

const router = Router();

// Cuando hagan un GET a la ruta base de productos, ejecuta la función getProductos
router.get('/', getProductos);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deactivateProducto);

export default router;
