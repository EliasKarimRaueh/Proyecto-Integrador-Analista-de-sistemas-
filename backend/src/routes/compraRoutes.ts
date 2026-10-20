import { Router } from 'express';
import { getCompras, getCompraById, postCompra } from '../controllers/compraController.js';

const router = Router();

router.get('/', getCompras);
router.get('/:id', getCompraById);
router.post('/', postCompra);

export default router;
