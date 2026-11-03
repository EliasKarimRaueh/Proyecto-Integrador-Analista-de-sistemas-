import { Router } from 'express';
import {
  getPedidos,
  getPedidoById,
  postPedido,
  postCancelarPedido
} from '../controllers/pedidoController.js';

const router = Router();

router.get('/', getPedidos);
router.get('/:id', getPedidoById);
router.post('/', postPedido);
router.post('/:id/cancelar', postCancelarPedido);

export default router;
