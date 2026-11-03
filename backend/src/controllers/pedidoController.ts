import { type Request, type Response } from 'express';
import { ejecutar, paginacion, rangoFechas } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as pedidos from '../services/pedidos.js';

export const getPedidos = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const proveedorId = req.query.proveedorId === undefined
    ? undefined
    : id(req.query.proveedorId, 'proveedorId');
  const estado = req.query.estado === undefined ? undefined : String(req.query.estado);

  const resultado = await pedidos.listarPedidos(page, limit, proveedorId, estado, desde, hasta);
  res.setHeader('X-Total-Count', resultado.count);
  return resultado.rows;
});

export const getPedidoById = (req: Request, res: Response) => ejecutar(res, () =>
  pedidos.detallePedido(id(req.params.id))
);

export const postPedido = (req: Request, res: Response) => ejecutar(res, () =>
  pedidos.registrarPedido(req.body), 201
);

export const postCancelarPedido = (req: Request, res: Response) => ejecutar(res, () =>
  pedidos.cancelarPedido(id(req.params.id))
);
