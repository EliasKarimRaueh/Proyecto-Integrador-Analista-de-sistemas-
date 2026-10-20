import { Router } from 'express';
import {
  getProductosDeProveedor,
  getProveedoresDeProducto,
  postRelacion,
  putRelacion,
  deleteRelacion
} from '../controllers/catalogoController.js';

const router = Router();

router.get('/proveedor/:proveedorId', getProductosDeProveedor);
router.get('/producto/:productoId', getProveedoresDeProducto);
router.post('/', postRelacion);
router.put('/:productoId/:proveedorId', putRelacion);
router.delete('/:productoId/:proveedorId', deleteRelacion);

export default router;
