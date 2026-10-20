import { Router } from 'express';
import { getCuentas, getCuentaById, getSaldoProveedor } from '../controllers/cuentaController.js';

const router = Router();

router.get('/', getCuentas);
router.get('/proveedor/:proveedorId', getSaldoProveedor);
router.get('/:id', getCuentaById);

export default router;
