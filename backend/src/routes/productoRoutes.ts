// backend/src/routes/productoRoutes.ts
import { Router } from 'express';
import { createProducto, deactivateProducto, getProductos, obtenerImagenProducto, updateProducto } from '../controllers/productoController.js';
import { manejarErrorDeSubida, subirFoto, validarFoto } from '../middleware/fotoProducto.js';

const router = Router();

// Cuando hagan un GET a la ruta base de productos, ejecuta la función getProductos
router.get('/', getProductos);
router.post('/', subirFoto, validarFoto, manejarErrorDeSubida, createProducto);
router.put('/:id', subirFoto, validarFoto, manejarErrorDeSubida, updateProducto);
router.delete('/:id', deactivateProducto);

// El archivo se sirve aparte del JSON del producto: el listado manda la URL y
// el navegador pide los bytes solo cuando muestra la imagen.
router.get('/:id/imagen', obtenerImagenProducto);

export default router;
