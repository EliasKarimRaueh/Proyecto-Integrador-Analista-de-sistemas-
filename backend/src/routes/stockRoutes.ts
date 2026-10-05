import { Router } from 'express';
import { getEstadoStock, getMovimientos, registrarMovimiento, registrarFraccionamiento, configurarReposicion } from '../controllers/stockController.js';

const router = Router();

router.get('/', getEstadoStock);
router.post('/movimientos', registrarMovimiento);
router.get('/movimientos', getMovimientos);
router.put('/:productoId/reposicion', configurarReposicion);
router.get('/movimientos/:productoId', getMovimientos);

router.post('/fraccionamientos', registrarFraccionamiento);

export default router;
