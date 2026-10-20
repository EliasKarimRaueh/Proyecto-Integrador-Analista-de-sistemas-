import { type Request, type Response } from 'express';
import { ejecutar } from './operacionesController.js';
import { id } from '../services/operaciones.js';
import * as catalogo from '../services/catalogo.js';

export const getProductosDeProveedor = (req: Request, res: Response) => ejecutar(res, () => {
  const soloActivos = req.query.activo === 'true';
  return catalogo.listarProductosDeProveedor(id(req.params.proveedorId, 'proveedorId'), soloActivos);
});

export const getProveedoresDeProducto = (req: Request, res: Response) => ejecutar(res, () =>
  catalogo.listarProveedoresDeProducto(id(req.params.productoId, 'productoId'))
);

export const postRelacion = (req: Request, res: Response) => ejecutar(res, () => catalogo.asociar(req.body), 201);

export const putRelacion = (req: Request, res: Response) => ejecutar(res, () => {
  const activo = req.body?.activo === true || req.body?.activo === 'true';
  return catalogo.cambiarEstado(
    id(req.params.productoId, 'productoId'),
    id(req.params.proveedorId, 'proveedorId'),
    activo
  );
});

export const deleteRelacion = (req: Request, res: Response) => ejecutar(res, () =>
  catalogo.desasociar(
    id(req.params.productoId, 'productoId'),
    id(req.params.proveedorId, 'proveedorId')
  )
);
