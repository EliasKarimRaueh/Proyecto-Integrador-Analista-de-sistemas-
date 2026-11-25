import type { UsuarioAutenticado } from '../services/auth.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};
