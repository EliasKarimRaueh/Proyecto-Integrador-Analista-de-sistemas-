import { type Request, type Response } from 'express';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as pagos from '../services/pagos.js';

export const getPagos = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const proveedorId = req.query.proveedorId === undefined ? undefined : id(req.query.proveedorId, 'proveedorId');
  const conSaldoPendiente = req.query.conSaldoPendiente === 'true';
  const resultado = await pagos.listarPagos(page, limit, proveedorId, desde, hasta, conSaldoPendiente);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getPagoById = (req: Request, res: Response) => ejecutar(res, () =>
  pagos.detallePago(id(req.params.id))
);

export const postPago = (req: Request, res: Response) => ejecutar(res, () =>
  pagos.registrarPago(req.body), 201
);
