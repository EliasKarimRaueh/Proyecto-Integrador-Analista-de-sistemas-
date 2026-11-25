import { Router } from 'express';
import {
  deleteUsuario,
  getUsuario,
  getUsuarios,
  postUsuario,
  putReactivarUsuario,
  putUsuario
} from '../controllers/usuarioController.js';
import { autenticar, soloPropietario } from '../middlewares/auth.js';

const router = Router();

router.use(autenticar, soloPropietario);

router.get('/', getUsuarios);
router.post('/', postUsuario);
router.get('/:id', getUsuario);
router.put('/:id', putUsuario);
router.delete('/:id', deleteUsuario);
router.put('/:id/reactivar', putReactivarUsuario);

export default router;
