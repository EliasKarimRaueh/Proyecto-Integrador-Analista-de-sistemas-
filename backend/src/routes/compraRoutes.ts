import { Router } from 'express';
import { getCompras, getCompraById, getReposicion, postCompra } from '../controllers/compraController.js';

const router = Router();

router.get('/', getCompras);
router.get('/reposicion', getReposicion);
router.get('/:id', getCompraById);
router.post('/', postCompra);

export default router;
