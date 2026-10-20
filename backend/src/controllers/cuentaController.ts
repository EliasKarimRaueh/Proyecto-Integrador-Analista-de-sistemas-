import { type Request, type Response } from 'express';
import { ejecutar, paginacion } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as cuentas from '../services/cuentas.js';

export const getCuentas = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const proveedorId = cuentas.parseProveedorId(req.query.proveedorId);
  const estado = cuentas.parseEstado(req.query.estado);
  const resultado = await cuentas.listarCuentas(page, limit, proveedorId, estado);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getCuentaById = (req: Request, res: Response) => ejecutar(res, () =>
  cuentas.detalleCuenta(id(req.params.id))
);

export const getSaldoProveedor = (req: Request, res: Response) => ejecutar(res, () =>
  cuentas.saldoProveedor(id(req.params.proveedorId, 'proveedorId'))
);
