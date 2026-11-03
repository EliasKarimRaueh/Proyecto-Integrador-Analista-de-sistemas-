import type { Request, Response } from 'express';
import { asociarProductos, estadoCuenta, productosProveedor, registrarComprobante, registrarPago } from '../services/proveedores.js';
import { ErrorOperacion, id } from '../services/validacion.js';
import { sendDatabaseError } from './controllerHelpers.js';

function endpoint(accion: (req: Request, proveedorId: number) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response) => {
    try { res.status(status).json(await accion(req, id(req.params.id, 'Proveedor'))); }
    catch (error) {
      if (error instanceof ErrorOperacion) res.status(error.status).json({ message: error.message });
      else sendDatabaseError(res, error, 'No se pudo completar la operación del proveedor.');
    }
  };
}
export const getProductosProveedor = endpoint((_req, id) => productosProveedor(id));
export const putProductosProveedor = endpoint((req, id) => asociarProductos(id, req.body));
export const getCuentaProveedor = endpoint((req, id) => estadoCuenta(id, req.query as Record<string, unknown>));
export const postPagoProveedor = endpoint((req, id) => registrarPago(id, req.body), 201);
export const postComprobanteProveedor = endpoint((req, id) => registrarComprobante(id, req.body), 201);
