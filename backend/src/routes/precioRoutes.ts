// backend/src/routes/precioRoutes.ts
import { Router } from 'express';
import {
  actualizarPrecio, desactivarPrecio, getHistorialPrecios, getPrecioVigente, registrarPrecio,
} from '../controllers/precioController.js';

const router = Router();

// El más específico va primero. Express exige match completo del path,
// pero dejarlos ordenados evita sorpresas al agregar rutas después.
router.get('/productos/:productoId/vigente', getPrecioVigente);
router.get('/productos/:productoId', getHistorialPrecios);

// Registra un precio nuevo: cierra el anterior y abre el nuevo.
router.post('/', registrarPrecio);

router.put('/:id', actualizarPrecio);
router.delete('/:id', desactivarPrecio);

export default router;
