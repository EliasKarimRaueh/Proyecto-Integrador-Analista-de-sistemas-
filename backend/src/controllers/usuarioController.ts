import type { Request, Response } from 'express';
import { id } from '../services/operaciones.js';
import {
  actualizarUsuario,
  bajarUsuario,
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  reactivarUsuario
} from '../services/usuarios.js';
import { ejecutar } from './operacionesController.js';
import { ErrorOperacion } from '../services/validacion.js';

function operador(req: Request): number {
  if (!req.usuario) throw new ErrorOperacion('Se requiere autenticación.', 401);
  return req.usuario.id;
}

function textoQuery(req: Request, campo: string): string | undefined {
  const valor = req.query[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new ErrorOperacion(`${campo} debe ser texto.`);
  return valor.trim() || undefined;
}

function activoQuery(req: Request): boolean | undefined {
  const valor = req.query.activo;
  if (valor === undefined) return undefined;
  if (valor !== 'true' && valor !== 'false') throw new ErrorOperacion('activo debe ser true o false.');
  return valor === 'true';
}

export const getUsuarios = (req: Request, res: Response) => ejecutar(res, () => listarUsuarios({
  q: textoQuery(req, 'q'),
  rol: textoQuery(req, 'rol'),
  activo: activoQuery(req)
}));

export const getUsuario = (req: Request, res: Response) => ejecutar(res, () =>
  obtenerUsuario(id(req.params.id))
);

export const postUsuario = (req: Request, res: Response) => ejecutar(res, () =>
  crearUsuario(req.body), 201
);

export const putUsuario = (req: Request, res: Response) => ejecutar(res, () =>
  actualizarUsuario(id(req.params.id), req.body, operador(req))
);

export const deleteUsuario = (req: Request, res: Response) => ejecutar(res, () =>
  bajarUsuario(id(req.params.id), operador(req))
);

export const putReactivarUsuario = (req: Request, res: Response) => ejecutar(res, () =>
  reactivarUsuario(id(req.params.id))
);
