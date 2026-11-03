import { type Request, type Response } from 'express';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
import { ErrorOperacion, id } from '../services/operaciones.js';
import * as compras from '../services/compras.js';

export const getCompras = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const proveedorId = req.query.proveedorId === undefined ? undefined : id(req.query.proveedorId, 'proveedorId');
  const estado = req.query.estado === undefined ? undefined : String(req.query.estado);
  const resultado = await compras.listarCompras(page, limit, proveedorId, desde, hasta, estado);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getCompraById = (req: Request, res: Response) => ejecutar(res, () =>
  compras.detalleCompra(id(req.params.id))
);

export const getReposicion = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const proveedorId = req.query.proveedorId === undefined ? undefined : id(req.query.proveedorId, 'proveedorId');
  if (req.query.q !== undefined && typeof req.query.q !== 'string') {
    throw new ErrorOperacion('q debe ser texto.');
  }
  const incluirProximos = String(req.query.incluirProximos ?? 'false') === 'true';
  const resultado = await compras.listarReposicion(
    page,
    limit,
    proveedorId,
    incluirProximos,
    String(req.query.q ?? '').trim() || undefined,
    ...(req.query.soloHabitual === 'true' ? [true] : [])
  );
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const postCompra = (req: Request, res: Response) => ejecutar(res, () =>
  compras.registrarCompra(req.body), 201
);
