import { Router } from 'express';
import {
  getRecepciones,
  getRecepcionById,
  postRecepcion
} from '../controllers/recepcionController.js';

const router = Router();

router.get('/', getRecepciones);
router.get('/:id', getRecepcionById);
router.post('/', postRecepcion);

export default router;
