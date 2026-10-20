import { Router } from 'express';
import { getPagos, getPagoById, postPago } from '../controllers/pagoController.js';

const router = Router();

router.get('/', getPagos);
router.get('/:id', getPagoById);
router.post('/', postPago);

export default router;
