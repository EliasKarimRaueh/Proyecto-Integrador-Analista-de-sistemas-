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

router.get('/', getProveedores);
router.get('/:id', getProveedorById);
router.post('/', createProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deactivateProveedor);
router.put('/:id/reactivar', reactivateProveedor);

export default router;