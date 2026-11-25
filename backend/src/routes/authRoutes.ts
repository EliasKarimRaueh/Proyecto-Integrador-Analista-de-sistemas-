import { Router } from 'express';
import { login, logout, me, refresh } from '../controllers/authController.js';
import { autenticar } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', autenticar, me);

export default router;
