// backend/src/routes/productoRoutes.ts
import { Router } from 'express';
import { createProducto, deactivateProducto, getProductos, updateProducto, reactivateProducto } from '../controllers/productoController.js';
import { soloPropietario } from '../middlewares/auth.js';

const router = Router();

// La lectura del catálogo es necesaria para operar (caja, stock, reposición).
// Alta, edición y baja son gestión: sólo el propietario.
router.get('/', getProductos);
router.post('/', soloPropietario, createProducto);
router.put('/:id', soloPropietario, updateProducto);
router.delete('/:id', soloPropietario, deactivateProducto);

router.put('/:id/reactivar', soloPropietario, reactivateProducto);

export default router;
