import { type Request, type Response } from 'express';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as compras from '../services/compras.js';

export const getCompras = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const proveedorId = req.query.proveedorId === undefined ? undefined : id(req.query.proveedorId, 'proveedorId');
  const resultado = await compras.listarCompras(page, limit, proveedorId, desde, hasta);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getCompraById = (req: Request, res: Response) => ejecutar(res, () =>
  compras.detalleCompra(id(req.params.id))
);

export const postCompra = (req: Request, res: Response) => ejecutar(res, () =>
  compras.registrarCompra(req.body), 201
);
