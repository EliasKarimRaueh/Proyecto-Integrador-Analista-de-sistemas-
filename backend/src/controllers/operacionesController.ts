import { type Request, type Response } from 'express';
import { ErrorOperacion, vender, buscarProductos, id } from '../services/operaciones.js';
import VentaRepository from 'polleria-database/repositories/ventaRepository';
import { sendDatabaseError } from './controllerHelpers.js';
import TipoProducto from 'polleria-database/models/TipoProducto';
import Usuario from 'polleria-database/models/Usuario';
import { Op } from 'sequelize';
export async function ejecutar(res: Response, accion: () => Promise<unknown>, status = 200) {
  try { res.status(status).json(await accion()); }
  catch (error) {
    if (error instanceof ErrorOperacion) res.status(error.status).json({ message: error.message });
    else sendDatabaseError(res, error, 'No se pudo completar la operación.');
  }
}
export function operadorId(req: Request): number {
  if (!req.usuario) throw new ErrorOperacion('Se requiere autenticación.', 401);
  return req.usuario.id;
}
export function paginacion(req: Request) {
  const page = id(req.query.page ?? 1, 'page'), limit = id(req.query.limite ?? 50, 'limite');
  if (limit > 1000) throw new ErrorOperacion('limite no puede superar 1000.');
  return { page, limit };
}
function fecha(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) throw new ErrorOperacion('Fecha inválida: utilice ISO 8601.');
  const calendario = new Date(value.slice(0, 10));
  if (Number.isNaN(calendario.getTime()) || calendario.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new ErrorOperacion('Fecha de calendario inválida.');
  return new Date(value);
}
export function rangoFechas(req: Request) {
  const desde = fecha(req.query.fechaDesde), hasta = fecha(req.query.fechaHasta);
  if (desde && hasta && desde > hasta) throw new ErrorOperacion('El rango de fechas es inválido.');
  return { desde, hasta };
}
const ventas = new VentaRepository();
export const crearVenta = (req: Request, res: Response) => ejecutar(res, () => vender(req.body, false, operadorId(req)), 201);
export const cotizarVenta = (req: Request, res: Response) => ejecutar(res, () => vender(req.body, true, operadorId(req)));
export const productosMostrador = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  if (req.query.q !== undefined && typeof req.query.q !== 'string') throw new ErrorOperacion('q debe ser texto.');
  if (req.query.categoria !== undefined && typeof req.query.categoria !== 'string') throw new ErrorOperacion('categoria debe ser texto.');
  return buscarProductos(String(req.query.q ?? '').trim(), page, limit, ...(req.query.categoria !== undefined || req.query.orden !== undefined ? [{ categoria: String(req.query.categoria ?? '').trim(), orden: String(req.query.orden ?? 'nombre_asc') }] : []));
});
export const categoriasMostrador = (_req: Request, res: Response) => ejecutar(res, () => TipoProducto.findAll({ where: { activo: true }, attributes: ['id', 'nombre'], order: [['nombre', 'ASC']] }));
function usuarioIdDe(venta: unknown): number {
  const instancia = venta as { get?: (campo: string) => unknown; usuarioId?: unknown } | null;
  const valor = instancia?.get ? instancia.get('usuarioId') : instancia?.usuarioId;
  return Number(valor);
}

function idValido(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor > 0;
}

async function nombresOperadores(ids: number[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids)].filter(idValido);
  if (!unicos.length) return new Map();
  try {
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: unicos } },
      attributes: ['id', 'nombre', 'apellido']
    });
    return new Map(usuarios.map(usuario => [usuario.id, `${usuario.nombre} ${usuario.apellido}`]));
  } catch {
    // El nombre del operador es enriquecimiento: si la tabla de usuarios no
    // está disponible, el historial de ventas debe seguir respondiendo.
    return new Map();
  }
}

/** Agrega `usuarioNombre` sólo cuando la venta tiene un operador identificable. */
function conNombreOperador(registro: Record<string, unknown>, venta: unknown, nombres: Map<number, string>) {
  const usuarioId = usuarioIdDe(venta);
  if (!idValido(usuarioId)) return registro;
  return { ...registro, usuarioNombre: nombres.get(usuarioId) ?? null };
}

export const historialVentas = (req: Request, res: Response) => ejecutar(res, async () => {
  const { page, limit } = paginacion(req);
  const { desde, hasta } = rangoFechas(req);
  const resultado = await ventas.findAllVentas(page, limit, desde, hasta, true);
  const nombres = await nombresOperadores(resultado.rows.map(fila => usuarioIdDe(fila.venta)));
  return {
    ...resultado,
    rows: resultado.rows.map(fila => conNombreOperador(fila as Record<string, unknown>, fila.venta, nombres))
  };
});
export const detalleVenta = (req: Request, res: Response) => ejecutar(res, async () => {
  const resultado = await ventas.findVentaConDetalles(id(req.params.id));
  if (!resultado.venta) throw new ErrorOperacion('Venta no encontrada.', 404);
  const nombres = await nombresOperadores([usuarioIdDe(resultado.venta)]);
  return conNombreOperador(resultado as Record<string, unknown>, resultado.venta, nombres);
});
