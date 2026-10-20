import { Router } from 'express';
import { 
  createProveedor, 
  deactivateProveedor, 
  getProveedores,
  getProveedorById,
  reactivateProveedor, 
  updateProveedor 
} from '../controllers/proveedorController.js';

const router = Router();
import { getProductosProveedor, putProductosProveedor, getCuentaProveedor, postPagoProveedor, postComprobanteProveedor } from '../controllers/cuentaProveedorController.js';

router.get('/:id/productos', getProductosProveedor);
router.put('/:id/productos', putProductosProveedor);
router.get('/:id/cuenta', getCuentaProveedor);
router.post('/:id/pagos', postPagoProveedor);
router.post('/:id/comprobantes', postComprobanteProveedor);

router.get('/', getProveedores);
router.get('/:id', getProveedorById);
router.post('/', createProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deactivateProveedor);
router.put('/:id/reactivar', reactivateProveedor);

export default router;
