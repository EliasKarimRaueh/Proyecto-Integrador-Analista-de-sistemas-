import type { RequestHandler } from 'express';
import { verificarAccessToken } from '../services/auth.js';

function sinAutorizacion(res: Parameters<RequestHandler>[1], message: string) {
  res.status(401).json({ message });
}

/**
 * Verifica el access token Bearer y deja el operador en `req.usuario`.
 *
 * En tests se puede habilitar un bypass explícito con AUTH_BYPASS=true;
 * nunca se activa fuera de NODE_ENV=test.
 */
export const autenticar: RequestHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && process.env.AUTH_BYPASS === 'true') {
    const id = Number(process.env.AUTH_BYPASS_ID ?? 2);
    req.usuario = {
      id: Number.isSafeInteger(id) && id > 0 ? id : 2,
      nombre: 'Operador',
      apellido: 'De prueba',
      email: 'operador@test.local',
      rol: 'PROPIETARIO',
      activo: true,
      jti: 'test-bypass'
    };
    next();
    return;
  }

  const autorizacion = req.headers.authorization;
  if (typeof autorizacion !== 'string' || !autorizacion.startsWith('Bearer ')) {
    sinAutorizacion(res, 'Se requiere autenticación.');
    return;
  }

  const token = autorizacion.slice('Bearer '.length).trim();
  if (!token) {
    sinAutorizacion(res, 'Se requiere autenticación.');
    return;
  }

  try {
    const { usuario } = await verificarAccessToken(token);
    req.usuario = usuario;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sesión inválida o vencida.';
    sinAutorizacion(res, message);
  }
};

export const soloPropietario: RequestHandler = (req, res, next) => {
  if (!req.usuario) {
    sinAutorizacion(res, 'Se requiere autenticación.');
    return;
  }
  if (req.usuario.rol !== 'PROPIETARIO') {
    res.status(403).json({ message: 'Esta operación requiere permisos de propietario.' });
    return;
  }
  next();
};
