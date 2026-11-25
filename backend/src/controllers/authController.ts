import type { Request, Response } from 'express';
import {
  iniciarSesion,
  milisegundosRefresh,
  renovarSesion,
  revocarSesionPorToken
} from '../services/auth.js';
import { ErrorOperacion } from '../services/validacion.js';

const COOKIE_REFRESH = 'refreshToken';

type ConCookies = Request & { cookies?: Record<string, string> };

function tokenDeCookie(req: Request): string | undefined {
  return (req as ConCookies).cookies?.[COOKIE_REFRESH];
}

function tokenDeHeader(req: Request): string | undefined {
  const autorizacion = req.headers.authorization;
  if (typeof autorizacion !== 'string' || !autorizacion.startsWith('Bearer ')) return undefined;
  const token = autorizacion.slice('Bearer '.length).trim();
  return token || undefined;
}

function opcionesCookie(recordarme: boolean) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: milisegundosRefresh(recordarme)
  };
}

function escribirRefresh(res: Response, token: string, recordarme: boolean) {
  res.cookie(COOKIE_REFRESH, token, opcionesCookie(recordarme));
}

function fallar(res: Response, error: unknown) {
  if (error instanceof ErrorOperacion) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error('Error de autenticación:', error);
  res.status(500).json({ message: 'No se pudo completar la autenticación.' });
}

export async function login(req: Request, res: Response) {
  try {
    const resultado = await iniciarSesion(req.body);
    escribirRefresh(res, resultado.refreshToken, resultado.recordarme);
    res.json({
      accessToken: resultado.accessToken,
      usuario: resultado.usuario
    });
  } catch (error) {
    fallar(res, error);
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = tokenDeCookie(req) ?? tokenDeHeader(req);
    await revocarSesionPorToken(token ?? '');
    res.clearCookie(COOKIE_REFRESH, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/' });
    res.json({ message: 'Sesión cerrada.' });
  } catch (error) {
    fallar(res, error);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const token = tokenDeCookie(req);
    if (!token) throw new ErrorOperacion('No hay sesión activa.', 401);
    const resultado = await renovarSesion(token);
    escribirRefresh(res, resultado.refreshToken, resultado.recordarme);
    res.json({
      accessToken: resultado.accessToken,
      usuario: resultado.usuario
    });
  } catch (error) {
    fallar(res, error);
  }
}

export function me(req: Request, res: Response) {
  const usuario = req.usuario;
  if (!usuario) {
    res.status(401).json({ message: 'Se requiere autenticación.' });
    return;
  }
  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo
  });
}
