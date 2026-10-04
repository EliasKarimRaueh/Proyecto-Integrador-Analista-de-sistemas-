import { Router } from 'express';
import { getEstadoStock, getMovimientos, registrarMovimiento, registrarFraccionamiento } from '../controllers/stockController.js';

const router = Router();

router.get('/', getEstadoStock);
router.post('/movimientos', registrarMovimiento);
router.get('/movimientos/:productoId', getMovimientos);

// NUEVA RUTA PARA FRACCIONAMIENTO[cite: 23, 26]
router.post('/fraccionamientos', registrarFraccionamiento);

export default router;