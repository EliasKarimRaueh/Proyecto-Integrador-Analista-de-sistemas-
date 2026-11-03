import { type Request, type Response } from 'express';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as recepciones from '../services/recepciones.js';

export const getRecepciones = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const compraId = req.query.compraId === undefined ? undefined : id(req.query.compraId, 'compraId');
  const proveedorId = req.query.proveedorId === undefined
    ? undefined
    : id(req.query.proveedorId, 'proveedorId');

  const resultado = await recepciones.listarRecepciones(page, limit, compraId, proveedorId, desde, hasta);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getRecepcionById = (req: Request, res: Response) => ejecutar(res, () =>
  recepciones.detalleRecepcion(id(req.params.id))
);

export const postRecepcion = (req: Request, res: Response) => ejecutar(res, () =>
  recepciones.registrarRecepcion(req.body), 201
);
