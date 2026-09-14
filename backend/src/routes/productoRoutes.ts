// backend/src/routes/productoRoutes.ts
import { Router } from 'express';
import {
    getProductos,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto
} from '../controllers/productoController.js';

const router = Router();

router.get('/', getProductos);
router.get('/:id', getProductoById);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;