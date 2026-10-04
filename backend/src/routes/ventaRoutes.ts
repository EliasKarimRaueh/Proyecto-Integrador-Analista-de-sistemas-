import { Router } from 'express';
import { crearVenta, cotizarVenta, productosMostrador, historialVentas, detalleVenta } from '../controllers/operacionesController.js';
const router = Router();
router.get('/productos', productosMostrador);
router.post('/cotizacion', cotizarVenta);
router.get('/', historialVentas);
router.get('/:id', detalleVenta);
router.post('/', crearVenta);
export default router;
