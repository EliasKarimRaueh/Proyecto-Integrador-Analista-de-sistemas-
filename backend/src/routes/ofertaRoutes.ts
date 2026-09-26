// backend/src/routes/ofertaRoutes.ts
import { Router } from 'express';
import {
  actualizarPrecioEnOferta, createOferta, desactivarOferta, getOferta, getOfertas,
  getOfertasDeProducto, getOfertasVigentes, getProductosDeOferta, quitarProductoDeOferta,
  updateOferta,
} from '../controllers/ofertaController.js';

const router = Router();

// CRÍTICO: /vigentes tiene que declararse antes que /:id. Express
// matchea en orden de declaración, así que si /:id fuera primero,
// GET /vigentes caería en parseId('vigentes') y devolvería un 400.
router.get('/vigentes', getOfertasVigentes);

// Ofertas de un producto. La ruta literal /productos también precede
// a /:id/productos para que /ofertas/productos/5 no se confunda.
router.get('/productos/:productoId', getOfertasDeProducto);

router.get('/', getOfertas);
router.post('/', createOferta);

router.get('/:id', getOferta);
router.put('/:id', updateOferta);
router.delete('/:id', desactivarOferta);

router.get('/:id/productos', getProductosDeOferta);
router.put('/:id/productos/:productoId', actualizarPrecioEnOferta);
router.delete('/:id/productos/:productoId', quitarProductoDeOferta);

export default router;
